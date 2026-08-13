const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const router = express.Router();
const jwt = require("jsonwebtoken");

// ── Configuração da verificação em duas etapas (2FA) ──────────────────────
const TWO_FACTOR_TTL_MS = 2 * 60 * 1000; // 2 minutos
const TWO_FACTOR_MAX_ATTEMPTS = 5;

// Código de 6 dígitos, gerado de forma criptograficamente segura.
const generateTwoFactorCode = () =>
  String(crypto.randomInt(0, 1000000)).padStart(6, "0");

// Guardamos apenas o hash do código (nunca o código em texto puro).
const hashTwoFactorCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

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
              <p>Olá, ${nome || "usuário"},</p>
              <p>Use o código abaixo para concluir o seu login no Painel V-CORP:</p>
              <div style="margin:28px 0;text-align:center;">
                <span style="display:inline-block;font-size:34px;font-weight:700;letter-spacing:10px;color:#111217;background:#f8f9fa;border:1px solid #e0e0e0;border-radius:8px;padding:14px 24px;">${code}</span>
              </div>
              <p style="font-size:14px;color:#6c757d;">Este código é válido por <strong>2 minutos</strong>. Se você não tentou fazer login, ignore este e-mail — sua conta continua segura.</p>
            </td></tr>
            <tr><td align="center" style="background:#f8f9fa;padding:20px;font-size:12px;color:#6c757d;">
              <p>V-CORP Inteligência Tributária © ${new Date().getFullYear()}</p>
              <p>Esta é uma mensagem automática. Por favor, não responda a este e-mail.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  // ── Helper: gera, salva e envia um novo código de verificação ────────────
  const sendTwoFactorCode = async (user) => {
    const code = generateTwoFactorCode();
    const expires = new Date(Date.now() + TWO_FACTOR_TTL_MS);
    await pool.query(
      `UPDATE users
         SET two_factor_code = $1, two_factor_expires = $2, two_factor_attempts = 0
       WHERE id = $3`,
      [hashTwoFactorCode(code), expires, user.id],
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
    const { email, password } = req.body;
    try {
      const result = await pool.query(
        "SELECT *, must_change_password FROM users WHERE email = $1",
        [email],
      );
      const user = result.rows[0];

      if (!user || !(await bcrypt.compare(password, user.password))) {
        logActivity(
          null,
          email,
          "Falha no Login",
          "Tentativa de login falhou.",
          req.ipAddress,
        );
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      // Credenciais OK → envia o código de verificação por e-mail. O token só
      // é emitido na 2ª etapa (POST /verify-2fa).
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
    const { email, code } = req.body;
    if (!email || !code) {
      return res
        .status(400)
        .json({ message: "E-mail e código são obrigatórios." });
    }
    try {
      const result = await pool.query(
        "SELECT *, must_change_password FROM users WHERE email = $1",
        [email],
      );
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

      if (user.two_factor_attempts >= TWO_FACTOR_MAX_ATTEMPTS) {
        await clearTwoFactor(user.id);
        return res.status(429).json({
          message: "Muitas tentativas. Faça o login novamente.",
        });
      }

      if (hashTwoFactorCode(code) !== user.two_factor_code) {
        await pool.query(
          "UPDATE users SET two_factor_attempts = two_factor_attempts + 1 WHERE id = $1",
          [user.id],
        );
        logActivity(
          user.id,
          user.email,
          "2FA Falhou",
          "Código de verificação incorreto.",
          req.ipAddress,
        );
        return res.status(401).json({ message: "Código incorreto." });
      }

      // Sucesso → limpa o 2FA e emite o token.
      await clearTwoFactor(user.id);

      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        nome: user.nome,
        must_change_password: user.must_change_password,
      };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
        expiresIn: "12h",
      });

      logActivity(
        user.id,
        user.email,
        "Login Bem-Sucedido",
        "Usuário logado com sucesso (verificação em duas etapas).",
        req.ipAddress,
      );

      delete user.password;
      delete user.two_factor_code;
      delete user.two_factor_expires;
      delete user.two_factor_attempts;

      res.json({ user, token });
    } catch (err) {
      console.error("Erro na rota /api/auth/verify-2fa:", err);
      res.status(500).send({ error: "Erro no servidor" });
    }
  });

  // ── POST /resend-2fa — reenvia o código (apenas se houver login pendente) ─
  router.post("/resend-2fa", async (req, res) => {
    const { email } = req.body;
    try {
      const result = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email],
      );
      const user = result.rows[0];

      // Só reenvia quando já existe um 2FA pendente — evita usar a rota como
      // oráculo de existência de e-mail ou como vetor de spam.
      if (user && user.two_factor_expires) {
        try {
          await sendTwoFactorCode(user);
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

  router.post("/solicitar-redefinicao", async (req, res) => {
    const { email } = req.body;
    try {
      const userResult = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email],
      );
      const user = userResult.rows[0];

      if (!user) {
        // Por segurança, enviamos a mesma mensagem mesmo que o usuário não exista
        return res.json({
          message:
            "Se um e-mail correspondente for encontrado em nosso sistema, um link para redefinição de senha será enviado.",
        });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
      const tokenExpiry = new Date(Date.now() + 900000); // 15 minutos

      await pool.query(
        "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
        [hashedToken, tokenExpiry, user.id],
      );

      const resetUrl = `https://painel.vcorporate.com.br/reset-password?token=${resetToken}`;

      // --- NOVO TEMPLATE DE EMAIL ESTILIZADO ---
      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <style> body { font-family: 'Montserrat', sans-serif; } </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center" style="padding: 20px 0;">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                  
                  <tr>
                    <td align="center" style="background-color: #111217; padding: 20px 0;">
                      <img src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1782936553/textobranco_zxw32o.png" alt="V-CORP Logo" style="width: 200px; height: auto;">
                    </td>
                  </tr>

                  <tr>
                    <td style="padding: 30px 40px; color: #2D2C2B; font-size: 16px; line-height: 1.6;">
                      <h2 style="font-size: 22px; color: #0D0D0D; margin-top: 0;">Redefinição de Senha</h2>
                      <p>Olá, ${user.nome},</p>
                      <p>Recebemos uma solicitação para redefinir a sua senha de acesso ao Painel V-CORP. Se foi você, clique no botão abaixo para criar uma nova senha:</p>
                      
                      <table border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                        <tr>
                          <td align="center" style="background-color: #daa520; border-radius: 5px;">
                            <a href="${resetUrl}" target="_blank" style="font-size: 16px; font-weight: bold; font-family: 'Montserrat', sans-serif; color: #ffffff; text-decoration: none; border-radius: 5px; padding: 12px 25px; display: inline-block;">Redefinir Minha Senha</a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="font-size: 14px; color: #6c757d;">Este link é válido por 15 minutos. Se você não solicitou esta alteração, por favor, ignore este e-mail. A sua senha atual permanecerá a mesma.</p>
                    </td>
                  </tr>

                  <tr>
                    <td align="center" style="background-color: #f8f9fa; padding: 20px; font-size: 12px; color: #6c757d;">
                      <p>V-CORP Inteligência Tributária © ${new Date().getFullYear()}</p>
                      <p>Esta é uma mensagem automática. Por favor, não responda a este email.</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await resend.emails.send({
        from: `Painel V-CORP <${process.env.EMAIL_FROM}>`,
        to: user.email,
        subject: "Redefinição de Senha - Painel V-CORP",
        html: html,
      });

      res.json({
        message:
          "Se um e-mail correspondente for encontrado em nosso sistema, um link para redefinição de senha será enviado.",
      });
    } catch (err) {
      console.error(
        "Erro ao solicitar redefinição de senha:",
        err.response ? err.response.data : err,
      );
      res.status(500).send({ error: "Erro no servidor" });
    }
  });

  router.post("/redefinir-senha", async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
      return res
        .status(400)
        .json({ error: "Token e nova senha são obrigatórios." });
    }
    try {
      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
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

      const newPasswordHash = await bcrypt.hash(password, 10);
      await pool.query(
        "UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
        [newPasswordHash, user.id],
      );
      logActivity(
        user.id,
        user.email,
        "Senha Redefinida",
        "Senha redefinida com sucesso através do link.",
        req.ipAddress,
      );
      res.json({ message: "Senha redefinida com sucesso!" });
    } catch (err) {
      console.error("Erro ao redefinir senha:", err);
      res.status(500).send({ error: "Erro no servidor" });
    }
  });
  return router;
};
