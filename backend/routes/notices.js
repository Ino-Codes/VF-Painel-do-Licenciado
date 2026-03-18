const express = require("express");
const router = express.Router();

const { isLoggedIn, isAdmin, checkRole } = require("../middleware/auth.js");

// IMPORTANTE: Adicionamos 'resend' nos parâmetros recebidos do app.js
module.exports = function (pool, createNotification, logActivity, resend) {
  router.get("/", isLoggedIn, async (req, res) => {
    const { role } = req.user;
    try {
      let query = "SELECT * FROM notices";
      let params = [];

      if (role !== "admin") {
        if (role === "licenciado") {
          query += " WHERE visibility = 'todos' OR visibility = 'licenciados'";
        } else if (role !== "licenciado") {
          query += " WHERE visibility = 'todos' OR visibility = 'internos'";
        } else {
          query += " WHERE visibility = 'todos'";
        }
      }

      query += " ORDER BY created_at DESC";

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar avisos:", err);
      res.status(500).json({ error: "Erro ao buscar avisos" });
    }
  });

  router.post("/", isLoggedIn, checkRole(["admin", "rh"]), async (req, res) => {
    // Recebendo o sendEmail do frontend
    const { message, visibility, sendEmail } = req.body;
    const creatorId = req.user.id;

    try {
      const result = await pool.query(
        "INSERT INTO notices (message, visibility) VALUES ($1, $2) RETURNING *",
        [message, visibility],
      );

      try {
        let targetUsersQuery = "";
        const params = [creatorId];

        // Atualizado para buscar nome e email também
        if (visibility === "todos") {
          targetUsersQuery = "SELECT id, nome, email FROM users WHERE id != $1";
        } else if (visibility === "licenciados") {
          targetUsersQuery =
            "SELECT id, nome, email FROM users WHERE role = 'licenciado' AND id != $1";
        } else if (visibility === "internos") {
          targetUsersQuery =
            "SELECT id, nome, email FROM users WHERE role IN ('admin', 'rh', 'comercial', 'operacional') AND id != $1";
        }

        if (targetUsersQuery) {
          const targetUsers = await pool.query(targetUsersQuery, params);
          const notificationMessage = "Um novo aviso foi postado no mural.";

          // 1. Cria notificações internas no painel
          for (const user of targetUsers.rows) {
            createNotification(user.id, notificationMessage, "/home");
          }

          // 2. Dispara os e-mails se a opção foi marcada no frontend
          if (sendEmail && resend) {
            const linkPainel =
              process.env.FRONTEND_URL || "https://painel.valorfiscal.com";

            Promise.all(
              targetUsers.rows.map(async (user) => {
                if (!user.email) return;

                const userName = user.nome.split(" ")[0];
                const resumoAviso = message;

                const html = `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                  <style>
                    body { font-family: 'Montserrat', sans-serif; }
                  </style>
                </head>
                <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                          
                          <tr>
                            <td align="center" style="background-color: #111217; padding: 20px 0;">
                              <img src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1761934050/logo-clara_grkjfa.png" alt="Valor Fiscal Logo" style="width: 200px; height: auto;">
                            </td>
                          </tr>

                          <tr>
                            <td style="padding: 30px 40px; color: #2D2C2B; font-size: 16px; line-height: 1.6;">
                              <h2 style="font-size: 22px; color: #0D0D0D; margin-top: 0;">Novo Aviso Publicado</h2>
                              <p>Olá, ${userName}!</p>
                              <p>Um novo aviso importante foi postado no Painel da Valor:</p>
                              
                              <hr style="border: 0; border-top: 1px solid #e9ecef; margin: 20px 0;">
                              
                              <div style="background-color: #ffffff; border: 1px solid #e9ecef; border-left: 5px solid #E6A822; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                                <p style="margin: 5px 0 0; font-size: 14px; color: #6c757d;">${resumoAviso}</p>
                              </div>
                              
                              <div style="text-align: center; margin-top: 25px;">
                                <a href="${linkPainel}" style="background-color: #111217; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-weight: bold; font-size: 14px; display: inline-block;">Acessar o Painel</a>
                              </div>
                            </td>
                          </tr>

                          <tr>
                            <td align="center" style="background-color: #f8f9fa; padding: 20px; font-size: 12px; color: #6c757d;">
                              <p>Valor Corp © ${new Date().getFullYear()}</p>
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

                try {
                  await resend.emails.send({
                    from: `Painel Valor Fiscal <${process.env.EMAIL_FROM}>`,
                    to: user.email,
                    subject: "Novo Aviso no Painel da Valor",
                    html: html,
                  });
                  console.log(`Aviso enviado por e-mail para ${user.email}`);
                } catch (emailErr) {
                  console.error(
                    `Erro ao enviar aviso por e-mail para ${user.email}:`,
                    emailErr,
                  );
                }
              }),
            );
          }
        }
      } catch (notifyErr) {
        console.error(
          "Erro ao processar notificações/e-mails de aviso:",
          notifyErr,
        );
      }

      try {
        await logActivity(
          req.user?.id || null,
          req.user?.email || "desconhecido",
          "Aviso Criado",
          `Foi postado um novo aviso. E-mail enviado: ${sendEmail ? "Sim" : "Não"}`,
          req.ipAddress,
        );
      } catch (e) {
        console.warn("Falha ao registrar log de postagem:", e);
      }

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao postar aviso:", err);
      res.status(500).json({ error: "Erro ao postar aviso" });
    }
  });

  router.put(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { message, visibility } = req.body;
      try {
        const result = await pool.query(
          "UPDATE notices SET message = $1, visibility = $2 WHERE id = $3 RETURNING *",
          [message, visibility, id],
        );
        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Aviso não encontrado." });
        }
        res.json(result.rows[0]);

        try {
          await logActivity(
            req.user?.id || null,
            req.user?.email || "desconhecido",
            "Aviso Editado",
            `Foi editado o aviso ID ${id}.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log de edição:", e);
        }
      } catch (err) {
        console.error("Erro ao editar aviso:", err);
        res.status(500).json({ error: "Erro ao editar aviso." });
      }
    },
  );

  router.delete(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      try {
        await pool.query("DELETE FROM notices WHERE id = $1", [id]);
        res.json({ success: true, message: "Aviso excluído com sucesso." });

        try {
          await logActivity(
            req.user?.id || null,
            req.user?.email || "desconhecido",
            "Aviso Excluído",
            `Foi excluído o aviso ID ${id}.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log de exclusão:", e);
        }
      } catch (err) {
        console.error("Erro ao excluir aviso:", err);
        res.status(500).json({ error: "Erro ao excluir aviso." });
      }
    },
  );

  return router;
};
