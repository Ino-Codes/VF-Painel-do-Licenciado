const express = require("express");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

module.exports = function (pool, cloudinary, upload, resend, logActivity) {
  // ── Helper: template de e-mail para atas de reunião ──────────────────────
  const getMeetingEmailTemplate = (
    title,
    description,
    attachments = [],
    userName = "usuário",
  ) => {
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
                  <img src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1761934050/logo-clara_grkjfa.png" alt="V-CORP Logo" style="width: 200px; height: auto;">
                </td>
              </tr>
              <tr>
                <td style="padding: 30px 40px; color: #2D2C2B; font-size: 16px; line-height: 1.6;">
                  <h2 style="font-size: 22px; color: #0D0D0D; margin-top: 0;">Ata de Reunião: ${title}</h2>
                  <p>Olá, ${userName}!</p>
                  <p>Você participou de uma reunião e a ata foi registrada no sistema.</p>
                  <hr style="border: 0; border-top: 1px solid #e9ecef; margin: 20px 0;">
                  <div style="background-color: #ffffff; border: 1px solid #e9ecef; border-left: 5px solid #E6A822; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <p style="margin: 5px 0 0; font-size: 14px; color: #6c757d;">${description}</p>
                  </div>
                  ${
                    attachments.length > 0
                      ? `<p style="color: #555; margin-top: 16px;"><strong>Arquivos anexados:</strong></p>
                         <ul style="color: #6366f1;">
                           ${attachments.map((f) => `<li><a href="${f.file_url}" target="_blank">${f.file_name}</a></li>`).join("")}
                         </ul>`
                      : ""
                  }
                  <div style="text-align: center; margin-top: 25px;">
                    <a href="${panelUrl}" style="background-color: #111217; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-weight: bold; font-size: 14px; display: inline-block;">Acessar o Painel</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td align="center" style="background-color: #f8f9fa; padding: 20px; font-size: 12px; color: #6c757d;">
                  <p>V-CORP © ${new Date().getFullYear()}</p>
                  <p>Esta é uma mensagem automática. Por favor, não responda a este email.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>`;
  };
  // ── GET /api/meeting-records ─────────────────────────────────────────────
  router.get("/", isLoggedIn, async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
      const countResult = await pool.query(
        "SELECT COUNT(*) FROM meeting_records",
      );
      const totalCount = parseInt(countResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalCount / Number(limit));

      const result = await pool.query(
        `SELECT m.*
         FROM meeting_records m
         ORDER BY m.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      const meetings = result.rows;

      // Busca participantes e anexos de cada reunião em batch
      if (meetings.length > 0) {
        const ids = meetings.map((m) => m.id);

        const participants = await pool.query(
          `SELECT mp.meeting_id, mp.user_id, mp.user_name
           FROM meeting_participants mp
           WHERE mp.meeting_id = ANY($1)`,
          [ids],
        );

        const attachments = await pool.query(
          `SELECT ma.meeting_id, ma.id, ma.file_name, ma.file_url, ma.file_type
           FROM meeting_attachments ma
           WHERE ma.meeting_id = ANY($1)`,
          [ids],
        );

        meetings.forEach((m) => {
          m.participants = participants.rows.filter(
            (p) => p.meeting_id === m.id,
          );
          m.attachments = attachments.rows.filter((a) => a.meeting_id === m.id);
        });
      }

      res.json({ meetings, totalCount, totalPages, currentPage: Number(page) });
    } catch (err) {
      console.error("Erro ao buscar reuniões:", err);
      res.status(500).json({ error: "Erro ao buscar reuniões." });
    }
  });

  // ── GET /api/meeting-records/internal-users ──────────────────────────────
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
        res.status(500).json({ error: "Erro ao buscar usuários." });
      }
    },
  );

  // ── POST /api/meeting-records ────────────────────────────────────────────
  router.post(
    "/",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    upload.array("attachments", 20),
    async (req, res) => {
      const { title, description, participantIds, sendEmail } = req.body;

      if (!title || !description) {
        return res
          .status(400)
          .json({ error: "Título e descrição são obrigatórios." });
      }

      const parsedIds = participantIds ? JSON.parse(participantIds) : [];

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Cria o registro da reunião
        const meetingResult = await client.query(
          `INSERT INTO meeting_records (title, description, creator_id, creator_name)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [title, description, req.user.id, req.user.nome || req.user.email],
        );
        const meeting = meetingResult.rows[0];

        // Insere participantes
        if (parsedIds.length > 0) {
          const usersResult = await client.query(
            `SELECT id, nome FROM users WHERE id = ANY($1)`,
            [parsedIds],
          );
          for (const u of usersResult.rows) {
            await client.query(
              `INSERT INTO meeting_participants (meeting_id, user_id, user_name)
               VALUES ($1, $2, $3)`,
              [meeting.id, u.id, u.nome],
            );
          }
        }

        // Faz upload dos arquivos para o Cloudinary
        const uploadedFiles = [];
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            const b64 = file.buffer.toString("base64");
            const dataUri = `data:${file.mimetype};base64,${b64}`;

            const uploadResult = await cloudinary.uploader.upload(dataUri, {
              folder: "meeting-records",
              resource_type: "auto",
              public_id: `meeting-${meeting.id}-${Date.now()}-${file.originalname}`,
            });

            await client.query(
              `INSERT INTO meeting_attachments (meeting_id, file_name, file_url, file_type)
               VALUES ($1, $2, $3, $4)`,
              [
                meeting.id,
                file.originalname,
                uploadResult.secure_url,
                file.mimetype,
              ],
            );

            uploadedFiles.push({
              file_name: file.originalname,
              file_url: uploadResult.secure_url,
            });
          }
        }

        await client.query("COMMIT");

        // Envia e-mail para os participantes selecionados (não-bloqueante)
        if (sendEmail === "true" && resend && parsedIds.length > 0) {
          (async () => {
            try {
              const emailResult = await pool.query(
                `SELECT email, nome FROM users WHERE id = ANY($1) AND email IS NOT NULL`,
                [parsedIds],
              );

              const recipients = emailResult.rows;
              if (recipients.length === 0) return;

              const emailFrom = `V-CORP <${process.env.EMAIL_FROM}>`;
              const emailSubject = `Ata de Reunião: ${title}`;
              const delay = (ms) =>
                new Promise((resolve) => setTimeout(resolve, ms));
              const batchSize = 3;

              for (let i = 0; i < recipients.length; i += batchSize) {
                const batch = recipients.slice(i, i + batchSize);

                await Promise.all(
                  batch.map(async (u) => {
                    const emailHtml = getMeetingEmailTemplate(
                      title,
                      description,
                      uploadedFiles,
                      u.nome ? u.nome.split(" ")[0] : "usuário",
                    );
                    try {
                      await resend.emails.send({
                        from: emailFrom,
                        to: u.email,
                        subject: emailSubject,
                        html: emailHtml,
                      });
                      console.log(
                        `[meeting-records] E-mail enviado para ${u.email}`,
                      );
                    } catch (emailErr) {
                      console.error(
                        `[meeting-records] Erro ao enviar para ${u.email}:`,
                        emailErr,
                      );
                    }
                  }),
                );

                if (i + batchSize < recipients.length) await delay(1000);
              }
              console.log("[meeting-records] Disparo em lote concluído.");
            } catch (err) {
              console.error(
                "[meeting-records] Erro ao processar e-mails:",
                err,
              );
            }
          })();
        }

        try {
          logActivity(
            req.user.id,
            req.user.email,
            "Ata de Reunião Criada",
            `Reunião "${title}" criada com ${parsedIds.length} participante(s).`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log:", e);
        }

        res.status(201).json({ success: true, id: meeting.id });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao criar reunião:", err);
        res.status(500).json({ error: "Erro ao criar reunião." });
      } finally {
        client.release();
      }
    },
  );

  // ── PUT /api/meeting-records/:id ─────────────────────────────────────────
  router.put(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    upload.array("attachments", 20),
    async (req, res) => {
      const { id } = req.params;
      const { title, description, participantIds } = req.body;

      if (!title || !description) {
        return res
          .status(400)
          .json({ error: "Título e descrição são obrigatórios." });
      }

      const parsedIds = participantIds ? JSON.parse(participantIds) : [];

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const existing = await client.query(
          "SELECT id FROM meeting_records WHERE id = $1",
          [id],
        );
        if (existing.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Reunião não encontrada." });
        }

        await client.query(
          `UPDATE meeting_records
           SET title = $1, description = $2, updated_at = NOW()
           WHERE id = $3`,
          [title, description, id],
        );

        // Atualiza participantes — remove todos e reinsere
        await client.query(
          "DELETE FROM meeting_participants WHERE meeting_id = $1",
          [id],
        );
        if (parsedIds.length > 0) {
          const usersResult = await client.query(
            "SELECT id, nome FROM users WHERE id = ANY($1)",
            [parsedIds],
          );
          for (const u of usersResult.rows) {
            await client.query(
              `INSERT INTO meeting_participants (meeting_id, user_id, user_name)
               VALUES ($1, $2, $3)`,
              [id, u.id, u.nome],
            );
          }
        }

        // Novos arquivos — só faz upload se houver
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            const b64 = file.buffer.toString("base64");
            const dataUri = `data:${file.mimetype};base64,${b64}`;

            const uploadResult = await cloudinary.uploader.upload(dataUri, {
              folder: "meeting-records",
              resource_type: "auto",
              public_id: `meeting-${id}-${Date.now()}-${file.originalname}`,
            });

            await client.query(
              `INSERT INTO meeting_attachments (meeting_id, file_name, file_url, file_type)
               VALUES ($1, $2, $3, $4)`,
              [id, file.originalname, uploadResult.secure_url, file.mimetype],
            );
          }
        }

        await client.query("COMMIT");
        res.json({ success: true });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao atualizar reunião:", err);
        res.status(500).json({ error: "Erro ao atualizar reunião." });
      } finally {
        client.release();
      }
    },
  );

  // ── DELETE /api/meeting-records/:id/attachments/:attachmentId ────────────
  router.delete(
    "/:id/attachments/:attachmentId",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { attachmentId } = req.params;
      try {
        const result = await pool.query(
          "DELETE FROM meeting_attachments WHERE id = $1 RETURNING file_url",
          [attachmentId],
        );
        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Anexo não encontrado." });
        }
        res.json({ success: true });
      } catch (err) {
        console.error("Erro ao excluir anexo:", err);
        res.status(500).json({ error: "Erro ao excluir anexo." });
      }
    },
  );

  // ── DELETE /api/meeting-records/:id ─────────────────────────────────────
  router.delete(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      try {
        const result = await pool.query(
          "DELETE FROM meeting_records WHERE id = $1 RETURNING title",
          [id],
        );
        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Reunião não encontrada." });
        }

        try {
          logActivity(
            req.user.id,
            req.user.email,
            "Ata de Reunião Excluída",
            `Reunião "${result.rows[0].title}" (ID ${id}) excluída.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log:", e);
        }

        res.json({ success: true });
      } catch (err) {
        console.error("Erro ao excluir reunião:", err);
        res.status(500).json({ error: "Erro ao excluir reunião." });
      }
    },
  );

  return router;
};
