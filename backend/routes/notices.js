const express = require("express");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

module.exports = function (pool, createNotification, logActivity, resend) {
  // ─── Helper: resolve company_id pelo slug ─────────────────────────────────
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

  // ─── Visibilidades válidas ─────────────────────────────────────────────────
  const VALID_VISIBILITIES = ["todos", "colaboradores", "licenciados"];

  // ─── Helper: cláusula de visibilidade para o GET ───────────────────────────
  // Define o que cada role pode ver no painel
  const getVisibilityClause = (role, userId, params) => {
    if (role === "admin") {
      // Admin vê tudo — sem cláusula extra
      return null;
    }

    if (role === "licenciado") {
      // Licenciados veem: todos + licenciados
      return "(n.visibility = 'todos' OR n.visibility = 'licenciados')";
    }

    // Colaboradores internos (rh, comercial, operacional, etc.) veem:
    // todos + colaboradores + avisos onde foram especificamente selecionados
    params.push(userId);
    return `(
      n.visibility = 'todos'
      OR n.visibility = 'colaboradores'
      OR EXISTS (
        SELECT 1 FROM notice_recipients nr
        WHERE nr.notice_id = n.id AND nr.user_id = $${params.length}
      )
    )`;
  };

  // ─── Helper: busca usuários alvo para notificação/email ───────────────────
  // Retorna usuários com base na visibilidade macro
  const getTargetUsers = async (visibility, creatorId) => {
    if (visibility === "todos") {
      const r = await pool.query(
        "SELECT id, nome, email FROM users WHERE id != $1",
        [creatorId],
      );
      return r.rows;
    }

    if (visibility === "colaboradores") {
      const r = await pool.query(
        "SELECT id, nome, email FROM users WHERE role != 'licenciado' AND id != $1",
        [creatorId],
      );
      return r.rows;
    }

    if (visibility === "licenciados") {
      const r = await pool.query(
        "SELECT id, nome, email FROM users WHERE role = 'licenciado' AND id != $1",
        [creatorId],
      );
      return r.rows;
    }

    return [];
  };

  // ─── Helper: template de e-mail ───────────────────────────────────────────
  const getEmailTemplate = (
    companySlug,
    companyName,
    messageContent,
    userName = "usuário",
  ) => {
    const logoMap = {
      "valor-fiscal": {
        logoUrl: process.env.LOGO_VALOR_FISCAL || "",
        primaryColor: "#d09829",
        bgColor: "#fff8e7",
        borderColor: "#d09829",
      },
      "valor-banking": {
        logoUrl: process.env.LOGO_VALOR_BANKING || "",
        primaryColor: "#0f57bd",
        bgColor: "#f0f5ff",
        borderColor: "#0f57bd",
      },
      "valor-business": {
        logoUrl: process.env.LOGO_VALOR_BUSINESS || "",
        primaryColor: "#0b961d",
        bgColor: "#f0fff3",
        borderColor: "#0b961d",
      },
      "valor-corporate": {
        logoUrl: process.env.LOGO_VALOR_CORPORATE || "",
        primaryColor: "#222222",
        bgColor: "#e9f8ff",
        borderColor: "#333333",
      },
    };

    const theme = logoMap[companySlug] || logoMap["valor-corporate"];
    const currentYear = new Date().getFullYear();
    const panelUrl =
      process.env.FRONTEND_URL || "https://painel.valorfiscal.com";

    return `<!DOCTYPE html>
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
                    <p style="margin: 5px 0 0; font-size: 14px; color: #6c757d;">${messageContent}</p>
                  </div>
                  
                  <div style="text-align: center; margin-top: 25px;">
                    <a href="${panelUrl}" style="background-color: #111217; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-weight: bold; font-size: 14px; display: inline-block;">Acessar o Painel</a>
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
  };

  // ─── GET /api/notices/internal-users ──────────────────────────────────────
  router.get(
    "/internal-users",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      try {
        const result = await pool.query(
          `SELECT id, nome, cargo, setor
           FROM users
           WHERE role != 'licenciado'
           ORDER BY nome ASC`,
        );
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao buscar usuários internos:", err);
        res.status(500).json({ error: "Erro ao buscar usuários internos." });
      }
    },
  );

  // ─── GET /api/notices ──────────────────────────────────────────────────────
  router.get("/", isLoggedIn, async (req, res) => {
    const { role, id: userId } = req.user;
    const { company, page = 1, limit = 10 } = req.query;

    try {
      const companyId = await getCompanyId(company);
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const offset = (pageNum - 1) * limitNum;

      const params = [companyId];
      const whereClauses = ["(n.company_id = $1 OR n.company_id IS NULL)"];

      // Aplica filtro de visibilidade conforme role
      const visibilityClause = getVisibilityClause(role, userId, params);
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
    const {
      message,
      visibility,
      sendEmail,
      company,
      selectedUserIds = [],
    } = req.body;
    const creatorId = req.user.id;

    if (!VALID_VISIBILITIES.includes(visibility)) {
      return res.status(400).json({ error: "Visibilidade inválida." });
    }

    try {
      const companyId = await getCompanyId(company);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // 1. Insere o aviso com a visibilidade macro escolhida
        const result = await client.query(
          "INSERT INTO notices (message, visibility, company_id, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
          [message, visibility, companyId, creatorId],
        );
        const noticeId = result.rows[0].id;

        // 2. Salva destinatários específicos de email (se houver)
        //    Apenas quando visibilidade != licenciados (lista não é exibida para licenciados)
        if (visibility !== "licenciados" && selectedUserIds.length > 0) {
          for (const uid of selectedUserIds) {
            await client.query(
              "INSERT INTO notice_recipients (notice_id, user_id) VALUES ($1, $2)",
              [noticeId, uid],
            );
          }
        }

        await client.query("COMMIT");

        const companyResult = await pool.query(
          "SELECT name, slug FROM companies WHERE id = $1",
          [companyId],
        );
        const companyData = companyResult.rows[0] || {
          name: "Valor Corp",
          slug: "valor-corporate",
        };

        // ── Notificações internas + e-mails (background) ──────────────────
        try {
          // Busca todos os usuários que têm permissão de ver o aviso
          const targetUsers = await getTargetUsers(visibility, creatorId);

          // Notificações internas no painel para todos que podem ver
          for (const u of targetUsers) {
            createNotification(
              u.id,
              "Um novo aviso foi postado no mural.",
              "/home",
            );
          }

          // Disparo de e-mails (não bloqueia a resposta)
          if (sendEmail && resend) {
            let emailTargets;

            if (visibility === "licenciados") {
              // Para licenciados: envia para todos os licenciados (sem seleção individual)
              emailTargets = targetUsers.filter((u) => u.email);
            } else if (selectedUserIds.length > 0) {
              // Há seleção específica: envia só para os selecionados
              emailTargets = targetUsers.filter(
                (u) => u.email && selectedUserIds.includes(u.id),
              );
            } else {
              // Sem seleção: envia para todos dentro da visibilidade
              emailTargets = targetUsers.filter((u) => u.email);
            }

            const emailSubject = `📢 Novo Aviso — ${companyData.name}`;
            const emailFrom = `${companyData.name} <${process.env.EMAIL_FROM}>`;

            (async () => {
              const delay = (ms) =>
                new Promise((resolve) => setTimeout(resolve, ms));
              const batchSize = 3;

              for (let i = 0; i < emailTargets.length; i += batchSize) {
                const batch = emailTargets.slice(i, i + batchSize);

                await Promise.all(
                  batch.map(async (u) => {
                    const emailHtml = getEmailTemplate(
                      companyData.slug,
                      companyData.name,
                      message,
                      u.nome ? u.nome.split(" ")[0] : "usuário",
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

                if (i + batchSize < emailTargets.length) await delay(1000);
              }
              console.log("[notices] Disparo em lote concluído.");
            })();
          }
        } catch (notifyErr) {
          console.error("[notices] Erro ao processar notificações:", notifyErr);
        }

        // Log
        try {
          logActivity(
            req.user?.id || null,
            req.user?.email || "desconhecido",
            "Aviso Criado",
            `Novo aviso postado. Visibilidade: ${visibility}. E-mail: ${sendEmail ? "Sim" : "Não"}. Destinatários específicos: ${selectedUserIds.length || "nenhum (todos da visibilidade)"}.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("[notices] Falha ao registrar log:", e);
        }

        res.status(201).json(result.rows[0]);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
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
      const { message, visibility, selectedUserIds = [] } = req.body;

      if (!VALID_VISIBILITIES.includes(visibility)) {
        return res.status(400).json({ error: "Visibilidade inválida." });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const result = await client.query(
          "UPDATE notices SET message = $1, visibility = $2 WHERE id = $3 RETURNING *",
          [message, visibility, id],
        );
        if (result.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Aviso não encontrado." });
        }

        // Recria os destinatários específicos de email
        await client.query(
          "DELETE FROM notice_recipients WHERE notice_id = $1",
          [id],
        );
        if (visibility !== "licenciados" && selectedUserIds.length > 0) {
          for (const uid of selectedUserIds) {
            await client.query(
              "INSERT INTO notice_recipients (notice_id, user_id) VALUES ($1, $2)",
              [id, uid],
            );
          }
        }

        await client.query("COMMIT");

        try {
          logActivity(
            req.user?.id || null,
            req.user?.email || "desconhecido",
            "Aviso Editado",
            `Aviso ID ${id} editado. Visibilidade: ${visibility}.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("[notices] Falha ao registrar log de edição:", e);
        }

        res.json(result.rows[0]);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao editar aviso:", err);
        res.status(500).json({ error: "Erro ao editar aviso." });
      } finally {
        client.release();
      }
    },
  );

  // ─── GET /api/notices/:id/recipients ──────────────────────────────────────
  router.get(
    "/:id/recipients",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      try {
        const result = await pool.query(
          "SELECT user_id FROM notice_recipients WHERE notice_id = $1",
          [id],
        );
        res.json(result.rows.map((r) => r.user_id));
      } catch (err) {
        console.error("Erro ao buscar destinatários:", err);
        res.status(500).json({ error: "Erro ao buscar destinatários." });
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
        await pool.query("DELETE FROM notice_recipients WHERE notice_id = $1", [
          id,
        ]);
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
