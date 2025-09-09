const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const router = express.Router();
const jwt = require("jsonwebtoken");

module.exports = function (pool, sgMail, logActivity) {
  router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);
      const user = result.rows[0];
      if (!user || !(await bcrypt.compare(password, user.password))) {
        logActivity(
          null,
          email,
          "LOGIN_FAIL",
          "Tentativa de login falhou.",
          req.ipAddress
        );
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        nome: user.nome,
      };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
        expiresIn: "24h",
      });

      logActivity(
        user.id,
        user.email,
        "LOGIN_SUCCESS",
        "Usuário logado com sucesso.",
        req.ipAddress
      );

      delete user.password;

      res.json({ user, token });
    } catch (err) {
      console.error("Erro na rota /api/login:", err);
      res.status(500).send({ error: "Erro no servidor" });
    }
  });

  router.post("/solicitar-redefinicao", async (req, res) => {
    const { email } = req.body;
    try {
      const userResult = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
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
        [hashedToken, tokenExpiry, user.id]
      );

      const resetUrl = `https://painel.valorfiscal.com/reset-password?token=${resetToken}`;

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
                      <img src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1754399924/logo-clara_guvics.png" alt="Valor Fiscal Logo" style="width: 200px; height: auto;">
                    </td>
                  </tr>

                  <tr>
                    <td style="padding: 30px 40px; color: #2D2C2B; font-size: 16px; line-height: 1.6;">
                      <h2 style="font-size: 22px; color: #0D0D0D; margin-top: 0;">Redefinição de Senha</h2>
                      <p>Olá, ${user.nome},</p>
                      <p>Recebemos uma solicitação para redefinir a sua senha de acesso ao Painel Valor Fiscal. Se foi você, clique no botão abaixo para criar uma nova senha:</p>
                      
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
                      <p>Valor Fiscal Inteligência Tributária © ${new Date().getFullYear()}</p>
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

      const msg = {
        to: user.email,
        from: process.env.EMAIL_FROM,
        subject: "Redefinição de Senha - Painel Valor Fiscal",
        html: html,
      };
      await sgMail.send(msg);

      res.json({
        message:
          "Se um e-mail correspondente for encontrado em nosso sistema, um link para redefinição de senha será enviado.",
      });
    } catch (err) {
      console.error("Erro ao solicitar redefinição de senha:", err);
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
        [hashedToken]
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
        [newPasswordHash, user.id]
      );
      logActivity(
        user.id,
        user.email,
        "PASSWORD_RESET",
        "Senha redefinida com sucesso através do link.",
        req.ipAddress
      );
      res.json({ message: "Senha redefinida com sucesso!" });
    } catch (err) {
      console.error("Erro ao redefinir senha:", err);
      res.status(500).send({ error: "Erro no servidor" });
    }
  });
  return router;
};
