// ───────────────────────────────────────────────────────────────────────────
// Links de definição de senha enviados por e-mail: a redefinição ("Esqueceu a
// senha?") e o convite de 1º acesso usam o mesmo token (reset_token, só o hash
// sha256 fica no banco), a mesma tela (/reset-password) e o mesmo e-mail.
//
// Convite: o admin não escolhe mais a senha inicial. A conta nasce com uma
// senha aleatória que ninguém conhece e o usuário cria a própria pelo link
// (a rota /redefinir-senha grava, zera must_change_password e encerra
// sessões). Reenviar o convite troca de novo a senha por uma aleatória — é o
// que tira do ar uma senha inicial previsível ou compartilhada.
// ───────────────────────────────────────────────────────────────────────────
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { gravarSenha } = require("./authSession.js");

const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://painel.vcorporate.com.br";

const REDEFINICAO_TTL_MS = 15 * 60 * 1000; // 15 minutos
const CONVITE_TTL_MS = 72 * 60 * 60 * 1000; // 72 horas

const hashDoToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

/** Hash bcrypt de uma senha aleatória descartada na hora: ninguém entra com ela. */
const senhaInutilizavel = () =>
  bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

const escaparHtml = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/**
 * Gera o token, grava o hash com a validade e devolve o link.
 * O convite também marca must_change_password, para a conta aparecer como
 * "convite pendente" até a senha ser criada.
 */
async function gerarLinkDeSenha(db, userId, { convite = false } = {}) {
  const token = crypto.randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + (convite ? CONVITE_TTL_MS : REDEFINICAO_TTL_MS));
  await db.query(
    `UPDATE users
        SET reset_token = $1, reset_token_expires = $2,
            must_change_password = CASE WHEN $3 THEN TRUE ELSE must_change_password END
      WHERE id = $4`,
    [hashDoToken(token), expira, convite, userId],
  );
  return `${FRONTEND_URL}/reset-password?token=${token}${convite ? "&convite=1" : ""}`;
}

const TEXTOS = {
  redefinicao: {
    assunto: "Redefinição de Senha - Painel V-CORP",
    titulo: "Redefinição de Senha",
    corpo:
      "Recebemos uma solicitação para redefinir a sua senha de acesso ao Painel V-CORP. Se foi você, clique no botão abaixo para criar uma nova senha:",
    botao: "Redefinir Minha Senha",
    rodape:
      "Este link é válido por 15 minutos. Se você não solicitou esta alteração, por favor, ignore este e-mail. A sua senha atual permanecerá a mesma.",
  },
  convite: {
    assunto: "Bem-vindo ao Painel V-CORP - Crie sua senha",
    titulo: "Bem-vindo ao Painel V-CORP",
    corpo:
      "Sua conta de acesso ao Painel V-CORP foi criada. Para começar, clique no botão abaixo e crie a sua senha:",
    botao: "Criar Minha Senha",
    rodape:
      "Este link é válido por 72 horas e pode ser usado uma única vez. Depois de criar a senha, entre no Painel com o seu e-mail: a cada login enviaremos um código de verificação para este endereço. Se o link expirar, peça ao administrador para reenviar o convite.",
  },
};

function htmlEmailDeSenha({ nome, url, convite = false }) {
  const t = convite ? TEXTOS.convite : TEXTOS.redefinicao;
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
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
                  <h2 style="font-size: 22px; color: #0D0D0D; margin-top: 0;">${t.titulo}</h2>
                  <p>Olá, ${escaparHtml(nome) || "usuário"},</p>
                  <p>${t.corpo}</p>
                  <table border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center" style="background-color: #daa520; border-radius: 5px;">
                        <a href="${url}" target="_blank" style="font-size: 16px; font-weight: bold; font-family: 'Montserrat', sans-serif; color: #ffffff; text-decoration: none; border-radius: 5px; padding: 12px 25px; display: inline-block;">${t.botao}</a>
                      </td>
                    </tr>
                  </table>
                  <p style="font-size: 14px; color: #6c757d;">${t.rodape}</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="background-color: #f8f9fa; padding: 20px; font-size: 12px; color: #6c757d;">
                  <p>V-CORP Soluções Corporativas © ${new Date().getFullYear()}</p>
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
}

/** Envia pelo Resend. O SDK devolve { error } em vez de lançar: lançamos aqui. */
async function enviarEmailDeSenha(resend, { email, nome, url, convite = false }) {
  const t = convite ? TEXTOS.convite : TEXTOS.redefinicao;
  const r = await resend.emails.send({
    from: `Painel V-CORP <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: t.assunto,
    html: htmlEmailDeSenha({ nome, url, convite }),
  });
  if (r && r.error) {
    const err = new Error(r.error.message || "Falha no envio pelo Resend.");
    err.resend = r.error;
    throw err;
  }
  return r;
}

/**
 * Convite de 1º acesso (criação ou reenvio).
 * `trocarSenha`: no reenvio a senha atual (a inicial antiga, talvez conhecida)
 * vira uma aleatória e as sessões abertas caem. Na criação a conta já nasce
 * com senha aleatória, então não precisa.
 */
async function enviarConvite(db, resend, user, { trocarSenha = true } = {}) {
  if (trocarSenha) {
    await gravarSenha(db, user.id, await senhaInutilizavel(), {
      limparTrocaObrigatoria: false,
    });
  }
  const url = await gerarLinkDeSenha(db, user.id, { convite: true });
  await enviarEmailDeSenha(resend, { email: user.email, nome: user.nome, url, convite: true });
}

module.exports = {
  CONVITE_TTL_MS,
  REDEFINICAO_TTL_MS,
  hashDoToken,
  senhaInutilizavel,
  gerarLinkDeSenha,
  htmlEmailDeSenha,
  enviarEmailDeSenha,
  enviarConvite,
};
