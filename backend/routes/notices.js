const express = require("express");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

module.exports = function (pool, createNotification, logActivity, resend) {
  // ─── Helper: resolve company_id pelo slug ──────────────────────────────────
  const getCompanyId = async (slug) => {
    if (!slug || slug === "undefined" || slug === "null") return 4;
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

  // ─── Roles válidas para visibilidade ──────────────────────────────────────
  const VALID_VISIBILITIES = [
    "todos",
    "admin",
    "rh",
    "comercial",
    "operacional",
    "licenciado",
  ];

  // ─── Helper: query de usuários alvo por visibilidade ─────────────────────
  // Retorna a cláusula WHERE de role para buscar os destinatários
  const getTargetUsersQuery = (visibility, creatorId) => {
    if (visibility === "todos") {
      return {
        sql: "SELECT id, nome, email FROM users WHERE id != $1",
        params: [creatorId],
      };
    }
    // Para qualquer role específica, busca exatamente aquela role
    return {
      sql: "SELECT id, nome, email FROM users WHERE role = $1 AND id != $2",
      params: [visibility, creatorId],
    };
  };

  // ─── Helper: cláusula de visibilidade para o GET (o que o usuário pode ver)
  const getVisibilityClause = (role) => {
    if (role === "admin") {
      // Admin vê tudo
      return null;
    }
    // Cada usuário vê: avisos para "todos" + avisos direcionados exatamente à sua role
    return `(n.visibility = 'todos' OR n.visibility = '${role}')`;
  };

  // ─── Helper: template de e-mail por empresa ───────────────────────────────
  const getEmailTemplate = (
    companySlug,
    companyName,
    messageContent,
    userName,
  ) => {
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

  // ─── GET /api/notices ──────────────────────────────────────────────────────
  router.get("/", isLoggedIn, async (req, res) => {
    const { role } = req.user;
    const { company, page = 1, limit = 10 } = req.query;

    try {
      const companyId = await getCompanyId(company);
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const offset = (pageNum - 1) * limitNum;

      const params = [companyId];
      const whereClauses = ["(n.company_id = $1 OR n.company_id IS NULL)"];

      // Filtro de visibilidade: admin vê tudo; demais veem "todos" + sua role
      const visibilityClause = getVisibilityClause(role);
      if (visibilityClause) {
        whereClauses.push(visibilityClause);
      }

      const whereString = `WHERE ${whereClauses.join(" AND ")}`;

      const countSql = `SELECT COUNT(*) FROM notices n ${whereString}`;
      const noticesSql = `
        SELECT n.*, u.nome AS creator_name
        FROM notices n
        LEFT JOIN users u ON n.created_by = u.id
        ${whereString}
        ORDER BY n.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const [countResult, noticesResult] = await Promise.all([
        pool.query(countSql, params),
        pool.query(noticesSql, [...params, limitNum, offset]),
      ]);

      res.json({
        notices: noticesResult.rows,
        totalCount: parseInt(countResult.rows[0].count, 10),
        totalPages: Math.ceil(
          parseInt(countResult.rows[0].count, 10) / limitNum,
        ),
        currentPage: pageNum,
      });
    } catch (err) {
      console.error("Erro ao buscar avisos:", err);
      res.status(500).json({ error: "Erro ao buscar avisos" });
    }
  });

  // ─── POST /api/notices ─────────────────────────────────────────────────────
  router.post("/", isLoggedIn, checkRole(["admin", "rh"]), async (req, res) => {
    const { message, visibility, sendEmail, company } = req.body;
    const creatorId = req.user.id;

    if (!VALID_VISIBILITIES.includes(visibility)) {
      return res.status(400).json({ error: "Visibilidade inválida." });
    }

    try {
      const companyId = await getCompanyId(company);

      const result = await pool.query(
        "INSERT INTO notices (message, visibility, company_id, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
        [message, visibility, companyId, creatorId],
      );

      const companyResult = await pool.query(
        "SELECT name, slug FROM companies WHERE id = $1",
        [companyId],
      );
      const companyData = companyResult.rows[0] || {
        name: "Valor Corp",
        slug: "valor-corporate",
      };

      // ── Notificações internas + e-mails (background) ──
      try {
        const { sql: targetSql, params: targetParams } = getTargetUsersQuery(
          visibility,
          creatorId,
        );
        const targetUsers = await pool.query(targetSql, targetParams);

        // 1. Notificações internas
        for (const u of targetUsers.rows) {
          createNotification(
            u.id,
            "Um novo aviso foi postado no mural.",
            "/home",
          );
        }

        // 2. Disparo de e-mails em lote (não bloqueia a resposta)
        if (sendEmail && resend) {
          const validUsers = targetUsers.rows.filter((u) => u.email);

          const emailSubject = `📢 Novo Aviso — ${companyData.name}`;
          const emailFrom = `${companyData.name} <${process.env.EMAIL_FROM}>`;

          (async () => {
            const delay = (ms) =>
              new Promise((resolve) => setTimeout(resolve, ms));
            const batchSize = 3;

            for (let i = 0; i < validUsers.length; i += batchSize) {
              const batch = validUsers.slice(i, i + batchSize);

              await Promise.all(
                batch.map(async (u) => {
                  // Personaliza o nome do usuário no template
                  const emailHtml = getEmailTemplate(
                    companyData.slug,
                    companyData.name,
                    message,
                    u.nome || "usuário",
                  );

                  try {
                    await resend.emails.send({
                      from: emailFrom,
                      to: u.email,
                      subject: emailSubject,
                      html: emailHtml,
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

              if (i + batchSize < validUsers.length) await delay(1000);
            }
            console.log("[notices] Disparo em lote concluído.");
          })();
        }
      } catch (notifyErr) {
        console.error("[notices] Erro ao processar notificações:", notifyErr);
      }

      // 3. Log
      try {
        logActivity(
          req.user?.id || null,
          req.user?.email || "desconhecido",
          "Aviso Criado",
          `Novo aviso postado para ${companyData.name}. Visibilidade: ${visibility}. E-mail: ${sendEmail ? "Sim" : "Não"}`,
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

  // ─── PUT /api/notices/:id ──────────────────────────────────────────────────
  router.put(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { message, visibility } = req.body;

      if (!VALID_VISIBILITIES.includes(visibility)) {
        return res.status(400).json({ error: "Visibilidade inválida." });
      }

      try {
        const result = await pool.query(
          "UPDATE notices SET message = $1, visibility = $2 WHERE id = $3 RETURNING *",
          [message, visibility, id],
        );
        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Aviso não encontrado." });
        }

        try {
          logActivity(
            req.user?.id || null,
            req.user?.email || "desconhecido",
            "Aviso Editado",
            `Aviso ID ${id} editado. Nova visibilidade: ${visibility}.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("[notices] Falha ao registrar log de edição:", e);
        }

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao editar aviso:", err);
        res.status(500).json({ error: "Erro ao editar aviso." });
      }
    },
  );

  // ─── DELETE /api/notices/:id ───────────────────────────────────────────────
  router.delete(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      try {
        await pool.query("DELETE FROM notices WHERE id = $1", [id]);

        try {
          logActivity(
            req.user?.id || null,
            req.user?.email || "desconhecido",
            "Aviso Excluído",
            `Aviso ID ${id} excluído.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("[notices] Falha ao registrar log de exclusão:", e);
        }

        res.json({ success: true, message: "Aviso excluído com sucesso." });
      } catch (err) {
        console.error("Erro ao excluir aviso:", err);
        res.status(500).json({ error: "Erro ao excluir aviso." });
      }
    },
  );

  return router;
};
