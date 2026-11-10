const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const router = express.Router();
const { isLoggedIn } = require("../middleware/auth.js");
const {
  semSegredos,
  normalizarEmail,
  validarSenha,
  gravarSenha,
  emitirSessao,
  ipDoCliente,
  excedeuLimite,
} = require("../authSession.js");
const { gerarLinkDeSenha, enviarEmailDeSenha, hashDoToken } = require("../linkDeSenha.js");

// ── Configuração da verificação em duas etapas (2FA) ──────────────────────
const TWO_FACTOR_TTL_MS = 2 * 60 * 1000; // 2 minutos
const TWO_FACTOR_MAX_ATTEMPTS = 5;
const TWO_FACTOR_MAX_ENVIOS = 5; // por usuário a cada 15 min (login + reenvios)

// ── Limites de tentativa (janela de 15 minutos) ───────────────────────────
// Por e-mail: segura a adivinhação de senha de uma conta. Por IP: segura
// quem testa senhas comuns em muitas contas. A janela é curta para quem
// errou de verdade não ficar preso — e a redefinição continua disponível.
const JANELA_MIN = 15;
const LOGIN_MAX_FALHAS_EMAIL = 10;
const LOGIN_MAX_FALHAS_IP = 30;
const REDEFINICAO_MAX_PEDIDOS = 3;

// Código de 6 dígitos, gerado de forma criptograficamente segura.
const generateTwoFactorCode = () =>
  String(crypto.randomInt(0, 1000000)).padStart(6, "0");

// Guardamos apenas o hash do código (nunca o código em texto puro).
const hashTwoFactorCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

// Comparação em tempo constante (os dois lados são hashes hex de 64 chars).
const mesmoHash = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length === b.length &&
  crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Hash descartável: o login de um e-mail inexistente também paga o custo do
// bcrypt, para o tempo de resposta não revelar quem tem conta.
const HASH_FICTICIO = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), 10);

const escaparHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const MSG_MUITAS_TENTATIVAS =
  "Muitas tentativas de login. Aguarde 15 minutos ou use “Esqueceu a senha?”.";

module.exports = function (pool, resend, logActivity) {
  // ── Helper: e-mail estilizado com o código de verificação ───────────────
  const buildTwoFactorEmailHtml = (nome, code) => `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="utf-8" /></head>
    <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr><td align="center" style="padding:20px 0;">
          <table width="600" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
            <tr><td align="center" style="background:#111217;padding:20px 0;">
              <img src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1782936553/textobranco_zxw32o.png" alt="V-CORP" style="width:200px;height:auto;">
            </td></tr>
            <tr><td style="padding:30px 40px;color:#2D2C2B;font-size:16px;line-height:1.6;">
              <h2 style="font-size:22px;color:#0D0D0D;margin-top:0;">Seu código de acesso</h2>
              <p>Olá, ${escaparHtml(nome) || "usuário"},</p>
              <p>Use o código abaixo para concluir o seu login no Painel V-CORP:</p>
              <div style="margin:28px 0;text-align:center;">
                <span style="display:inline-block;font-size:34px;font-weight:700;letter-spacing:10px;color:#111217;background:#f8f9fa;border:1px solid #e0e0e0;border-radius:8px;padding:14px 24px;">${code}</span>
              </div>
              <p style="font-size:14px;color:#6c757d;">Este código é válido por <strong>2 minutos</strong>. Se você não tentou fazer login, ignore este e-mail — sua conta continua segura.</p>
            </td></tr>
            <tr><td align="center" style="background:#f8f9fa;padding:20px;font-size:12px;color:#6c757d;">
              <p>V-CORP Soluções Corporativas © ${new Date().getFullYear()}</p>
              <p>Esta é uma mensagem automática. Por favor, não responda a este e-mail.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  // ── Helper: gera, salva e envia um novo código de verificação ────────────
  // O reenvio troca o código mas NÃO zera as tentativas: senão cada reenvio
  // daria mais 5 chutes. Só um login novo (que exige a senha) zera.
  const sendTwoFactorCode = async (user, { zerarTentativas = true } = {}) => {
    const code = generateTwoFactorCode();
    const expires = new Date(Date.now() + TWO_FACTOR_TTL_MS);
    await pool.query(
      `UPDATE users
         SET two_factor_code = $1, two_factor_expires = $2,
             two_factor_attempts = CASE WHEN $4 THEN 0 ELSE two_factor_attempts END
       WHERE id = $3`,
      [hashTwoFactorCode(code), expires, user.id, zerarTentativas],
    );
    await resend.emails.send({
      from: `Painel V-CORP <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: "Seu código de acesso - Painel V-CORP",
      html: buildTwoFactorEmailHtml(user.nome, code),
    });
  };

  // ── Helper: limpa o estado de 2FA do usuário ─────────────────────────────
  const clearTwoFactor = (userId) =>
    pool.query(
      `UPDATE users
         SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0
       WHERE id = $1`,
      [userId],
    );

  // ── POST /login — 1ª etapa: valida credenciais e dispara o código ────────
  router.post("/login", async (req, res) => {
    const email = normalizarEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password) {
      return res.status(400).json({ message: "Informe e-mail e senha." });
    }
    try {
      // Bloqueio temporário ANTES de conferir a senha: enquanto durar, nem a
      // senha certa entra — é o que impede a adivinhação.
      const ip = ipDoCliente(req);
      const [porEmail, porIp] = await Promise.all([
        excedeuLimite(pool, { acao: "Falha no Login", minutos: JANELA_MIN, maximo: LOGIN_MAX_FALHAS_EMAIL, email }),
        excedeuLimite(pool, { acao: "Falha no Login", minutos: JANELA_MIN, maximo: LOGIN_MAX_FALHAS_IP, ip }),
      ]);
      if (porEmail || porIp) {
        logActivity(
          null,
          email,
          "Login Bloqueado",
          porEmail
            ? "Muitas senhas incorretas para este e-mail em 15 minutos."
            : "Muitas tentativas falhas a partir deste IP em 15 minutos.",
          req.ipAddress,
        );
        return res.status(429).json({ message: MSG_MUITAS_TENTATIVAS });
      }

      const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      const user = result.rows[0];

      const senhaOk = await bcrypt.compare(password, user ? user.password : HASH_FICTICIO);
      if (!user || !senhaOk) {
        logActivity(
          null,
          email,
          "Falha no Login",
          user ? "Senha incorreta." : "E-mail não cadastrado.",
          req.ipAddress,
        );
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      // Credenciais OK → envia o código de verificação por e-mail. O token só
      // é emitido na 2ª etapa (POST /verify-2fa).
      if (
        await excedeuLimite(pool, {
          acao: "2FA Enviado",
          minutos: JANELA_MIN,
          maximo: TWO_FACTOR_MAX_ENVIOS,
          userId: user.id,
        })
      ) {
        return res.status(429).json({
          message:
            "Muitos códigos enviados em pouco tempo. Use o último código recebido ou aguarde 15 minutos.",
        });
      }
      try {
        await sendTwoFactorCode(user);
      } catch (mailErr) {
        console.error("Falha ao enviar código 2FA:", mailErr);
        return res.status(500).json({
          message:
            "Não foi possível enviar o código de verificação. Tente novamente em instantes.",
        });
      }

      logActivity(
        user.id,
        user.email,
        "2FA Enviado",
        "Código de verificação enviado por e-mail.",
        req.ipAddress,
      );

      res.json({ twoFactorRequired: true, email: user.email });
    } catch (err) {
      console.error("Erro na rota /api/login:", err);
      res.status(500).send({ error: "Erro no servidor" });
    }
  });

  // ── POST /verify-2fa — 2ª etapa: valida o código e emite o token ─────────
  router.post("/verify-2fa", async (req, res) => {
    const email = normalizarEmail(req.body?.email);
    const code = String(req.body?.code ?? "").trim();
    if (!email || !code) {
      return res
        .status(400)
        .json({ message: "E-mail e código são obrigatórios." });
    }
    try {
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      const user = result.rows[0];

      if (!user || !user.two_factor_code || !user.two_factor_expires) {
        return res.status(400).json({
          message: "Nenhum código pendente. Faça o login novamente.",
        });
      }

      if (new Date(user.two_factor_expires) < new Date()) {
        await clearTwoFactor(user.id);
        return res
          .status(400)
          .json({ message: "Código expirado. Faça o login novamente." });
      }

      // Consome a tentativa ANTES de comparar, numa única instrução: várias
      // requisições em paralelo não conseguem passar das 5 tentativas.
      const tentativa = await pool.query(
        `UPDATE users SET two_factor_attempts = two_factor_attempts + 1
          WHERE id = $1 AND two_factor_code IS NOT NULL AND two_factor_attempts < $2
          RETURNING two_factor_code`,
        [user.id, TWO_FACTOR_MAX_ATTEMPTS],
      );
      if (!tentativa.rowCount) {
        await clearTwoFactor(user.id);
        return res.status(429).json({
          message: "Muitas tentativas. Faça o login novamente.",
        });
      }

      const hashDigitado = hashTwoFactorCode(code);
      if (!mesmoHash(hashDigitado, tentativa.rows[0].two_factor_code)) {
        logActivity(
          user.id,
          user.email,
          "2FA Falhou",
          "Código de verificação incorreto.",
          req.ipAddress,
        );
        return res.status(401).json({ message: "Código incorreto." });
      }

      // Sucesso → o código vale uma vez só: quem limpar primeiro leva.
      const consumido = await pool.query(
        `UPDATE users
            SET two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0
          WHERE id = $1 AND two_factor_code = $2`,
        [user.id, hashDigitado],
      );
      if (!consumido.rowCount) {
        return res.status(400).json({
          message: "Nenhum código pendente. Faça o login novamente.",
        });
      }
      const { token, user: dados } = await emitirSessao(pool, user.id);

      logActivity(
        user.id,
        user.email,
        "Login Bem-Sucedido",
        "Usuário logado com sucesso (verificação em duas etapas).",
        req.ipAddress,
      );

      res.json({ user: dados, token });
    } catch (err) {
      console.error("Erro na rota /api/auth/verify-2fa:", err);
      res.status(500).send({ error: "Erro no servidor" });
    }
  });

  // ── POST /resend-2fa — reenvia o código (apenas se houver login pendente) ─
  router.post("/resend-2fa", async (req, res) => {
    const email = normalizarEmail(req.body?.email);
    try {
      const result = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email],
      );
      const user = result.rows[0];

      // Só reenvia quando já existe um 2FA pendente — evita usar a rota como
      // oráculo de existência de e-mail ou como vetor de spam — e dentro do
      // limite de envios.
      if (
        user &&
        user.two_factor_expires &&
        !(await excedeuLimite(pool, {
          acao: "2FA Enviado",
          minutos: JANELA_MIN,
          maximo: TWO_FACTOR_MAX_ENVIOS,
          userId: user.id,
        }))
      ) {
        try {
          await sendTwoFactorCode(user, { zerarTentativas: false });
          logActivity(
            user.id,
            user.email,
            "2FA Enviado",
            "Código de verificação reenviado por e-mail.",
            req.ipAddress,
          );
        } catch (mailErr) {
          console.error("Falha ao reenviar código 2FA:", mailErr);
        }
      }

      res.json({
        message: "Se houver um login pendente, um novo código foi enviado.",
      });
    } catch (err) {
      console.error("Erro na rota /api/auth/resend-2fa:", err);
      res.status(500).send({ error: "Erro no servidor" });
    }
  });

  // A resposta é sempre a mesma e sai antes do envio: nem o texto nem o tempo
  // de resposta revelam se o e-mail tem conta. Pedidos acima do limite são
  // ignorados em silêncio (evita encher a caixa de alguém de e-mails).
  const RESPOSTA_REDEFINICAO = {
    message:
      "Se um e-mail correspondente for encontrado em nosso sistema, um link para redefinição de senha será enviado.",
  };

  router.post("/solicitar-redefinicao", async (req, res) => {
    const email = normalizarEmail(req.body?.email);
    if (!email) return res.json(RESPOSTA_REDEFINICAO);
    try {
      const excedeu = await excedeuLimite(pool, {
        acao: "Redefinição Solicitada",
        minutos: JANELA_MIN,
        maximo: REDEFINICAO_MAX_PEDIDOS,
        email,
      });
      res.json(RESPOSTA_REDEFINICAO);
      if (excedeu) return;
      enviarLinkDeRedefinicao(email, req.ipAddress).catch((err) =>
        console.error(
          "Erro ao enviar o link de redefinição de senha:",
          err?.response ? err.response.data : err,
        ),
      );
    } catch (err) {
      console.error("Erro ao solicitar redefinição de senha:", err);
      res.status(500).send({ error: "Erro no servidor" });
    }
  });

  const enviarLinkDeRedefinicao = async (email, ipAddress) => {
      const userResult = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email],
      );
      const user = userResult.rows[0];

      // Registra também os pedidos de e-mail sem conta: contam para o limite.
      await logActivity(
        user ? user.id : null,
        email,
        "Redefinição Solicitada",
        user ? "Link de redefinição enviado por e-mail." : "E-mail não cadastrado.",
        ipAddress,
      );
      if (!user) return;

      // Mesmo token, tela e e-mail do convite de 1º acesso (linkDeSenha.js);
      // aqui a validade é de 15 minutos.
      const url = await gerarLinkDeSenha(pool, user.id);
      await enviarEmailDeSenha(resend, { email: user.email, nome: user.nome, url });
  };

  router.post("/redefinir-senha", async (req, res) => {
    const { token, password } = req.body || {};
    if (typeof token !== "string" || !token || !password) {
      return res
        .status(400)
        .json({ error: "Token e nova senha são obrigatórios." });
    }
    try {
      const hashedToken = hashDoToken(token);
      const userResult = await pool.query(
        "SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
        [hashedToken],
      );
      const user = userResult.rows[0];

      if (!user) {
        return res.status(400).json({
          error:
            "Token inválido ou expirado. Por favor, solicite a redefinição novamente.",
        });
      }

      const erroSenha = validarSenha(password, user.email);
      if (erroSenha) return res.status(400).json({ error: erroSenha });

      // O link vale uma vez só: consome o token na mesma instrução que o
      // confere (dois envios simultâneos não redefinem duas vezes).
      const consumido = await pool.query(
        `UPDATE users SET reset_token = NULL, reset_token_expires = NULL
          WHERE id = $1 AND reset_token = $2 AND reset_token_expires > NOW()`,
        [user.id, hashedToken],
      );
      if (!consumido.rowCount) {
        return res.status(400).json({
          error:
            "Token inválido ou expirado. Por favor, solicite a redefinição novamente.",
        });
      }

      // Quem redefine pelo link já escolheu a própria senha: não precisa
      // trocar de novo no 1º acesso. As sessões abertas são encerradas.
      // Vale também para o convite (conta com must_change_password).
      const primeiroAcesso = Boolean(user.must_change_password);
      const newPasswordHash = await bcrypt.hash(password, 10);
      await gravarSenha(pool, user.id, newPasswordHash);
      logActivity(
        user.id,
        user.email,
        primeiroAcesso ? "Senha Criada pelo Convite" : "Senha Redefinida",
        primeiroAcesso
          ? "Senha criada pelo link do convite (1º acesso)."
          : "Senha redefinida com sucesso através do link. Sessões abertas foram encerradas.",
        req.ipAddress,
      );
      res.json({
        message: primeiroAcesso
          ? "Senha criada com sucesso! Entre com o seu e-mail e a nova senha."
          : "Senha redefinida com sucesso!",
      });
    } catch (err) {
      console.error("Erro ao redefinir senha:", err);
      res.status(500).send({ error: "Erro no servidor" });
    }
  });

  // ── GET /me — dados atualizados do usuário logado (inclui permissões) ──────
  // Usado pelo frontend para manter as permissões em sincronia sem exigir
  // novo login quando o admin edita as permissões de um grupo.
  router.get("/me", isLoggedIn, async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM users WHERE id = $1", [
        req.user.id,
      ]);
      if (!result.rows[0]) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }
      const user = semSegredos(result.rows[0]);
      let groupName = null;
      if (user.group_id) {
        const gRes = await pool.query(
          "SELECT name FROM user_groups WHERE id = $1",
          [user.group_id],
        );
        groupName = gRes.rows[0] ? gRes.rows[0].name : null;
      }
      user.group_name = groupName;
      // Permissões resolvidas pelo isLoggedIn (base no group_id do token) —
      // mantém a UI alinhada ao que o backend efetivamente autoriza.
      user.permissions = req.user.permissions || [];

      res.json({ user });
    } catch (err) {
      console.error("Erro na rota /api/auth/me:", err);
      res.status(500).send({ error: "Erro no servidor" });
    }
  });

  return router;
};
