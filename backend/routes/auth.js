const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const router = express.Router();

module.exports = function (pool, sgMail, logActivity) {
  // POST /api/auth/login
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
      logActivity(
        user.id,
        user.email,
        "LOGIN_SUCCESS",
        "Usuário logado com sucesso.",
        req.ipAddress
      );
      delete user.password;
      delete user.reset_token;
      delete user.reset_token_expires;
      res.json(user);
    } catch (err) {
      console.error("Erro na rota /api/login:", err);
      res.status(500).send({ error: "Erro no servidor" });
    }
  });

  // POST /api/auth/solicitar-redefinicao
  router.post("/solicitar-redefinicao", async (req, res) => {
    const { email } = req.body;
    try {
      const userResult = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );
      const user = userResult.rows[0];

      if (!user) {
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
      const tokenExpiry = new Date(Date.now() + 900000);

      await pool.query(
        "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
        [hashedToken, tokenExpiry, user.id]
      );

      const resetUrl = `https://painel.valorfiscal.com/reset-password?token=${resetToken}`;
      const msg = {
        to: user.email,
        from: process.env.EMAIL_FROM,
        subject: "Redefinição de Senha - Painel do Licenciado",
        html: `<p>Olá, ${user.nome}.</p><p>Você solicitou a redefinição da sua senha do Painel do Licenciado. Por favor, clique no link abaixo para criar uma nova senha:</p><a href="${resetUrl}" target="_blank">Redefinir Minha Senha</a><p>Este link é válido por 15 minutos. Se você não solicitou esta alteração, por favor, ignore este e-mail.</p><p>Atenciosamente,<br>Equipe Valor Fiscal</p>`,
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

  // POST /api/auth/redefinir-senha
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
        return res
          .status(400)
          .json({
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
