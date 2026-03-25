const express = require("express");
const router = express.Router();

const { isLoggedIn, checkRole } = require("../middleware/auth.js");

module.exports = function (pool, createNotification, logActivity, resend) {
  // ─── Helper: resolve company_id pelo slug ────────────────────────────────────
  const getCompanyId = async (slug) => {
    if (!slug || slug === "undefined" || slug === "null") return 4; // Valor Corp como padrão
    try {
      const result = await pool.query(
        "SELECT id FROM companies WHERE slug = $1",
        [slug],
      );
      return result.rows.length > 0 ? result.rows[0].id : 4;
    } catch (error) {
      console.error("Erro ao resolver company_id para notices:", error);
      return 4;
    }
  };

  // ─── Helper: template de e-mail por empresa ──────────────────────────────────
  const getEmailTemplate = (companySlug, companyName, messageContent) => {
    // Cores exatas conforme tabela companies no banco
    const logoMap = {
      "valor-fiscal": {
        logoUrl:
          process.env.LOGO_VALOR_FISCAL ||
          "https://res.cloudinary.com/SEU_CLOUD/image/upload/v1/logos/valor-fiscal-logo.png",
        primaryColor: "#d09829",
        bgColor: "#fff8e7",
        borderColor: "#d09829",
        fromName: "Valor Fiscal",
      },
      "valor-banking": {
        logoUrl:
          process.env.LOGO_VALOR_BANKING ||
          "https://res.cloudinary.com/SEU_CLOUD/image/upload/v1/logos/valor-banking-logo.png",
        primaryColor: "#0f57bd",
        bgColor: "#f0f5ff",
        borderColor: "#0f57bd",
        fromName: "Valor Banking",
      },
      "valor-business": {
        logoUrl:
          process.env.LOGO_VALOR_BUSINESS ||
          "https://res.cloudinary.com/SEU_CLOUD/image/upload/v1/logos/valor-business-logo.png",
        primaryColor: "#0b961d",
        bgColor: "#f0fff3",
        borderColor: "#0b961d",
        fromName: "Valor Business",
      },
      "valor-corporate": {
        logoUrl:
          process.env.LOGO_VALOR_CORPORATE ||
          "https://res.cloudinary.com/SEU_CLOUD/image/upload/v1/logos/valor-corporate-logo.png",
        primaryColor: "#222222",
        bgColor: "#e9f8ff",
        borderColor: "#333333",
        fromName: "Valor Corp",
      },
    };

    const theme = logoMap[companySlug] || logoMap["valor-corporate"];
    const currentYear = new Date().getFullYear();
    const publishedAt = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const panelUrl = process.env.FRONTEND_URL || "https://app.valorcorp.com.br";

    return `<!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Novo Aviso no Painel da ${companyName}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#ececec;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ececec;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="
              background-color:#ffffff;
              border-radius:10px;
              overflow:hidden;
              box-shadow:0 4px 12px rgba(0,0,0,0.08);
              max-width:600px;
              width:100%;
            ">

              <tr>
                <td style="
                  background-color:${theme.primaryColor};
                  padding:30px 40px;
                  text-align:center;
                ">
                  <img
                    src="${theme.logoUrl}"
                    alt="${companyName}"
                    width="160"
                    style="display:block;margin:0 auto;max-height:60px;object-fit:contain;"
                  />
                </td>
              </tr>

              <tr>
                <td style="
                  background-color:${theme.bgColor};
                  border-bottom:3px solid ${theme.borderColor};
                  padding:20px 40px;
                  text-align:center;
                ">
                  <p style="
                    margin:0;
                    font-size:12px;
                    font-weight:700;
                    text-transform:uppercase;
                    letter-spacing:1.5px;
                    color:${theme.primaryColor};
                  ">${companyName}</p>
                  <h1 style="
                    margin:8px 0 0 0;
                    font-size:22px;
                    color:#1a1a1a;
                    font-weight:700;
                  ">Novo Aviso Publicado</h1>
                  <p style="font-size:13px;color:#888888;margin:0 0 25px 0;">
                    Olá, ${userName}! <br />
                    Um novo aviso importante foi postado no Painel da Valor:
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:35px 40px;">

                  <div style="
                    background-color:#f9f9f9;
                    border-left:4px solid ${theme.primaryColor};
                    border-radius:0 6px 6px 0;
                    padding:20px 25px;
                    margin-bottom:25px;
                    font-size:15px;
                    line-height:1.7;
                    color:#333333;
                  ">
                    ${messageContent}
                  </div>

                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td align="center">
                        <a
                          href="${panelUrl}/home"
                          style="
                            display:inline-block;
                            background-color:${theme.primaryColor};
                            color:#ffffff;
                            text-decoration:none;
                            font-weight:700;
                            font-size:14px;
                            padding:14px 35px;
                            border-radius:6px;
                            letter-spacing:0.5px;
                          "
                        >Acessar o Painel</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              
              <tr>
                <td style="
                  background-color:#f5f5f5;
                  border-top:1px solid #e0e0e0;
                  padding:20px 40px;
                  text-align:center;
                ">
                  <p style="margin:0 0 6px 0;font-size:12px;color:#999999;">
                    Esta é uma mensagem automática. Por favor, não responda a este email.
                  </p>
                  <p style="margin:0;font-size:11px;color:#bbbbbb;">
                    © ${currentYear} ${companyName} — Todos os direitos reservados.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>`;
  };

  // ─── GET /api/notices ────────────────────────────────────────────────────────
  router.get("/", isLoggedIn, async (req, res) => {
    const { role } = req.user;
    const { company, page = 1, limit = 10 } = req.query;

    try {
      const companyId = await getCompanyId(company);
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const offset = (pageNum - 1) * limitNum;

      const whereClauses = [];
      const params = [];

      // Filtro de empresa: avisos da empresa + avisos globais (NULL)
      params.push(companyId);
      whereClauses.push("(n.company_id = $1 OR n.company_id IS NULL)");

      // Filtro de visibilidade por role
      if (role === "licenciado") {
        whereClauses.push(
          "(n.visibility = 'todos' OR n.visibility = 'licenciados')",
        );
      } else if (role === "admin") {
        // admin vê tudo — sem filtro extra
      } else {
        whereClauses.push(
          "(n.visibility = 'todos' OR n.visibility = 'internos')",
        );
      }

      const whereString =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const countSql = `SELECT COUNT(*) FROM notices n ${whereString}`;

      const limitIndex = params.length + 1;
      const offsetIndex = params.length + 2;

      const noticesSql = `
        SELECT
          n.*,
          u.nome AS creator_name
        FROM notices n
        LEFT JOIN users u ON n.created_by = u.id
        ${whereString}
        ORDER BY n.created_at DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `;

      const [countResult, noticesResult] = await Promise.all([
        pool.query(countSql, params),
        pool.query(noticesSql, [...params, limitNum, offset]),
      ]);

      const totalCount = parseInt(countResult.rows[0].count, 10);

      res.json({
        notices: noticesResult.rows,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        currentPage: pageNum,
      });
    } catch (err) {
      console.error("Erro ao buscar avisos:", err);
      res.status(500).json({ error: "Erro ao buscar avisos" });
    }
  });

  // ─── POST /api/notices ───────────────────────────────────────────────────────
  router.post("/", isLoggedIn, checkRole(["admin", "rh"]), async (req, res) => {
    const { message, visibility, sendEmail, company } = req.body;
    const creatorId = req.user.id;

    try {
      const companyId = await getCompanyId(company);

      // Salva o aviso com company_id e created_by
      const result = await pool.query(
        "INSERT INTO notices (message, visibility, company_id, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
        [message, visibility, companyId, creatorId],
      );

      // Busca dados da empresa para o template de e-mail
      const companyResult = await pool.query(
        "SELECT name, slug FROM companies WHERE id = $1",
        [companyId],
      );
      const companyData = companyResult.rows[0] || {
        name: "Valor Corp",
        slug: "valor-corporate",
      };

      // ── Notificações internas + e-mails (em background) ──
      try {
        let targetUsersQuery = "";
        const queryParams = [creatorId];

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
          const targetUsers = await pool.query(targetUsersQuery, queryParams);
          const notificationMessage = "Um novo aviso foi postado no mural.";

          // 1. Notificações internas no painel
          for (const u of targetUsers.rows) {
            createNotification(u.id, notificationMessage, "/home");
          }

          // 2. Disparo de e-mails em lote (background, não bloqueia a resposta)
          if (sendEmail && resend) {
            const validUsers = targetUsers.rows.filter((u) => u.email);

            // Monta o HTML UMA VEZ para todos (mesmo template, personalização por empresa)
            const emailHtml = getEmailTemplate(
              companyData.slug,
              companyData.name,
              message,
            );

            // Subject e remetente dinâmicos por empresa
            const emailSubject = `📢 Novo Aviso — ${companyData.name}`;
            const emailFrom = `${companyData.name} <${process.env.EMAIL_FROM}>`;

            (async () => {
              const delay = (ms) =>
                new Promise((resolve) => setTimeout(resolve, ms));
              const batchSize = 3; // Resend: limite seguro de 3/s

              for (let i = 0; i < validUsers.length; i += batchSize) {
                const batch = validUsers.slice(i, i + batchSize);

                await Promise.all(
                  batch.map(async (u) => {
                    try {
                      await resend.emails.send({
                        from: emailFrom, // ← dinâmico por empresa
                        to: u.email,
                        subject: emailSubject, // ← dinâmico por empresa
                        html: emailHtml, // ← corrigido (era `html` undefined)
                      });
                      console.log(`[notices] E-mail enviado para ${u.email}`);
                    } catch (emailErr) {
                      console.error(
                        `[notices] Erro ao enviar para ${u.email}:`,
                        emailErr,
                      );
                    }
                  }),
                );

                if (i + batchSize < validUsers.length) {
                  await delay(1000);
                }
              }
              console.log("[notices] Disparo em lote concluído.");
            })();
          }
        }
      } catch (notifyErr) {
        console.error("[notices] Erro ao processar notificações:", notifyErr);
      }

      // 3. Log de atividade
      try {
        await logActivity(
          req.user?.id || null,
          req.user?.email || "desconhecido",
          "Aviso Criado",
          `Novo aviso postado para ${companyData.name}. E-mail: ${sendEmail ? "Sim" : "Não"}`,
          req.ipAddress,
        );
      } catch (e) {
        console.warn("[notices] Falha ao registrar log:", e);
      }

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao postar aviso:", err);
      res.status(500).json({ error: "Erro ao postar aviso" });
    }
  });

  // ─── PUT /api/notices/:id ────────────────────────────────────────────────────
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
            `Aviso ID ${id} editado.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("[notices] Falha ao registrar log de edição:", e);
        }
      } catch (err) {
        console.error("Erro ao editar aviso:", err);
        res.status(500).json({ error: "Erro ao editar aviso." });
      }
    },
  );

  // ─── DELETE /api/notices/:id ─────────────────────────────────────────────────
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
            `Aviso ID ${id} excluído.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("[notices] Falha ao registrar log de exclusão:", e);
        }
      } catch (err) {
        console.error("Erro ao excluir aviso:", err);
        res.status(500).json({ error: "Erro ao excluir aviso." });
      }
    },
  );

  return router;
};
