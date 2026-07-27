const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://painel.vcorporate.com.br";

const VALID_STATUSES = [
  "novo",
  "analise",
  "andamento",
  "concluido",
  "arquivado",
];
const VALID_TYPES = ["help", "suggestion", "bug"];

const TYPE_LABELS = {
  help: "Ajuda",
  bug: "Bug",
  suggestion: "Sugestão",
};

// Fluxo de status permitido — deve espelhar o ALLOWED_TRANSITIONS do frontend.
const ALLOWED_TRANSITIONS = {
  novo: ["andamento"],
  andamento: ["concluido", "arquivado"],
  concluido: [],
  arquivado: ["andamento"],
};

const isAllowedTransition = (from, to) =>
  from === to || (ALLOWED_TRANSITIONS[from] || []).includes(to);

module.exports = function (pool, logActivity, resend) {
  // ── Helper: escapa valores do usuário antes de injetar no HTML do e-mail ──
  const escapeHtml = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // ── Helper: monta o corpo HTML estilizado do e-mail (padrão do Painel) ────
  const buildEmailHtml = ({ heading, greetingName, bodyHtml }) => `
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
              <h2 style="font-size:22px;color:#0D0D0D;margin-top:0;">${heading}</h2>
              <p>Olá, ${escapeHtml(greetingName)},</p>
              ${bodyHtml}
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

  // ── Helper: botão "Acompanhar meu chamado" nos e-mails ────────────────────
  const trackButtonHtml = (trackingToken) => {
    if (!trackingToken) return "";
    const trackUrl = `${FRONTEND_URL}/acompanhar?t=${trackingToken}`;
    return `
        <table border="0" cellspacing="0" cellpadding="0" style="margin:24px 0 12px;">
          <tr><td align="center" style="background:#daa520;border-radius:5px;">
            <a href="${trackUrl}" target="_blank" style="font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;padding:12px 24px;display:inline-block;">Acompanhar meu chamado</a>
          </td></tr>
        </table>
        <p style="font-size:13px;color:#6c757d;margin:0 0 8px;">Ou copie e cole este endereço no seu navegador:</p>
        <p style="font-size:13px;margin:0;word-break:break-all;"><a href="${trackUrl}" target="_blank" style="color:#daa520;">${trackUrl}</a></p>`;
  };

  // ── Helper: campos seguros expostos no acompanhamento público ─────────────
  const publicTicketView = (t) => ({
    id: t.id,
    type: t.type,
    title: t.title,
    status: t.status,
    created_at: t.created_at,
    tenant_name: t.tenant_name || null,
    attendant_name: t.attendant_name || null,
    resolution_notes: t.status === "concluido" ? t.resolution_notes : null,
  });

  // ── POST /api/ticket (público — chamado pelo widget) ────────────────────
  router.post("/", async (req, res) => {
    const {
      token,
      type,
      name,
      title,
      description,
      origin_url,
      requester_email,
    } = req.body;

    if (!token || !title) {
      return res
        .status(400)
        .json({ error: "Token e título são obrigatórios." });
    }

    if (!requester_email || !requester_email.includes("@")) {
      return res
        .status(400)
        .json({ error: "E-mail do solicitante é obrigatório." });
    }

    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: "Tipo inválido." });
    }

    try {
      // Valida o token e verifica se o tenant está ativo
      const tenantResult = await pool.query(
        "SELECT id FROM widget_tenants WHERE token = $1 AND active = true",
        [token],
      );

      if (tenantResult.rowCount === 0) {
        return res
          .status(401)
          .json({ error: "Token inválido ou tenant inativo." });
      }

      const tenantId = tenantResult.rows[0].id;
      const trackingToken = crypto.randomBytes(32).toString("hex");

      const result = await pool.query(
        `INSERT INTO tickets (tenant_id, type, title, description, origin_url, name, requester_email, tracking_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          tenantId,
          type,
          title,
          description,
          origin_url,
          name,
          requester_email,
          trackingToken,
        ],
      );

      const ticket = result.rows[0];

      // ── E-mail de confirmação de abertura (não bloqueante) ──
      try {
        const typeLabel = TYPE_LABELS[ticket.type] || "Chamado";
        await resend.emails.send({
          from: `Painel V-CORP <${process.env.EMAIL_FROM}>`,
          to: requester_email,
          subject: `Chamado #${ticket.id} aberto - Painel V-CORP`,
          html: buildEmailHtml({
            heading: "Chamado aberto com sucesso",
            greetingName: name || "solicitante",
            bodyHtml: `
              <p>Recebemos o seu chamado e ele já está registrado no nosso sistema.</p>
              <p style="background:#f8f9fa;border-left:4px solid #daa520;padding:12px 16px;border-radius:4px;">
                <strong>Protocolo:</strong> #${ticket.id}<br/>
                <strong>Tipo:</strong> ${typeLabel}<br/>
                <strong>Título:</strong> ${escapeHtml(ticket.title)}
              </p>
              <p>Nossa equipe irá analisá-lo em breve. Acompanhe o andamento pelo botão abaixo ou guarde o número do protocolo.</p>
              ${trackButtonHtml(ticket.tracking_token)}
            `,
          }),
        });
      } catch (mailErr) {
        console.warn("Falha ao enviar e-mail de abertura:", mailErr);
      }

      res.status(201).json({ success: true, id: ticket.id });
    } catch (err) {
      console.error("Erro ao salvar ticket:", err);
      res.status(500).json({ error: "Erro ao salvar ticket." });
    }
  });

  // ── GET /api/ticket/track/:token (público — acompanhamento por link) ─────
  router.get("/track/:token", async (req, res) => {
    const { token } = req.params;
    try {
      const result = await pool.query(
        `SELECT t.*, wt.name AS tenant_name
         FROM tickets t
         LEFT JOIN widget_tenants wt ON t.tenant_id = wt.id
         WHERE t.tracking_token = $1`,
        [token],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Chamado não encontrado." });
      }
      res.json(publicTicketView(result.rows[0]));
    } catch (err) {
      console.error("Erro ao consultar chamado (token):", err);
      res.status(500).json({ error: "Erro ao consultar chamado." });
    }
  });

  // ── POST /api/ticket/track (público — consulta por protocolo + e-mail) ────
  router.post("/track", async (req, res) => {
    const { id, email } = req.body;
    const ticketId = parseInt(String(id ?? "").replace(/\D/g, ""), 10);

    if (!ticketId || !email) {
      return res
        .status(400)
        .json({ error: "Protocolo e e-mail são obrigatórios." });
    }

    try {
      const result = await pool.query(
        `SELECT t.*, wt.name AS tenant_name
         FROM tickets t
         LEFT JOIN widget_tenants wt ON t.tenant_id = wt.id
         WHERE t.id = $1 AND LOWER(t.requester_email) = LOWER($2)`,
        [ticketId, String(email).trim()],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({
          error: "Chamado não encontrado. Confira o protocolo e o e-mail.",
        });
      }
      res.json(publicTicketView(result.rows[0]));
    } catch (err) {
      console.error("Erro ao consultar chamado (protocolo):", err);
      res.status(500).json({ error: "Erro ao consultar chamado." });
    }
  });

  // ── GET /api/tickets (protegido — painel interno) ───────────────────────
  router.get("/", isLoggedIn, checkRole(["admin", "rh"]), async (req, res) => {
    const { tenant_id, status, type } = req.query;

    try {
      const params = [];
      const whereClauses = [];

      if (tenant_id) {
        params.push(tenant_id);
        whereClauses.push(`f.tenant_id = $${params.length}`);
      }

      if (status) {
        params.push(status);
        whereClauses.push(`f.status = $${params.length}`);
      }

      if (type) {
        params.push(type);
        whereClauses.push(`f.type = $${params.length}`);
      }

      const whereString =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const result = await pool.query(
        `SELECT f.*, wt.name AS tenant_name
         FROM tickets f
         LEFT JOIN widget_tenants wt ON f.tenant_id = wt.id
         ${whereString}
         ORDER BY f.created_at DESC`,
        params,
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar tickets:", err);
      res.status(500).json({ error: "Erro ao buscar tickets." });
    }
  });

  // ── PATCH /api/tickets/:id (atualiza status / observação / resolução) ────
  // Aceita qualquer combinação dos campos; monta o UPDATE dinamicamente.
  router.patch(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { status, observation, resolution_notes } = req.body;

      if (status !== undefined && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Status inválido." });
      }

      const fields = [];
      const params = [];

      if (status !== undefined) {
        params.push(status);
        fields.push(`status = $${params.length}`);
      }
      if (observation !== undefined) {
        params.push(observation);
        fields.push(`observation = $${params.length}`);
      }
      if (resolution_notes !== undefined) {
        params.push(resolution_notes);
        fields.push(`resolution_notes = $${params.length}`);
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: "Nenhum campo para atualizar." });
      }

      params.push(id);

      try {
        // Valida a transição contra o fluxo permitido (somente quando o status muda)
        if (status !== undefined) {
          const cur = await pool.query(
            "SELECT status FROM tickets WHERE id = $1",
            [id],
          );
          if (cur.rowCount === 0) {
            return res.status(404).json({ error: "Ticket não encontrado." });
          }
          const from = cur.rows[0].status;
          if (!isAllowedTransition(from, status)) {
            return res.status(409).json({
              error: `Transição de status não permitida: ${from} → ${status}.`,
            });
          }
        }

        const result = await pool.query(
          `UPDATE tickets SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
          params,
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Ticket não encontrado." });
        }

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao atualizar ticket:", err);
        res.status(500).json({ error: "Erro ao atualizar ticket." });
      }
    },
  );

  // ── PATCH /api/tickets/:id/attend (inicia atendimento) ──────────────────
  router.patch(
    "/:id/attend",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;

      try {
        const result = await pool.query(
          `UPDATE tickets
         SET status = 'andamento',
             attendant_id = $1,
             attendant_name = $2
         WHERE id = $3
         RETURNING *`,
          [req.user.id, req.user.nome || req.user.email, id],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Ticket não encontrado." });
        }

        try {
          logActivity(
            req.user.id,
            req.user.email,
            "Atendimento Iniciado",
            `Ticket ID ${id} assumido por ${req.user.nome || req.user.email}.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log:", e);
        }

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao iniciar atendimento:", err);
        res.status(500).json({ error: "Erro ao iniciar atendimento." });
      }
    },
  );

  // ── PATCH /api/tickets/:id/close (encerra atendimento + e-mail) ─────────
  router.patch(
    "/:id/close",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { resolution_notes } = req.body;

      try {
        const result = await pool.query(
          `UPDATE tickets
             SET status = 'concluido',
                 resolution_notes = COALESCE($1, resolution_notes)
           WHERE id = $2
           RETURNING *`,
          [resolution_notes, id],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Ticket não encontrado." });
        }

        const ticket = result.rows[0];

        // Busca o e-mail do atendente para colocar em cópia (CC)
        let attendantEmail = null;
        if (ticket.attendant_id) {
          const att = await pool.query(
            "SELECT email FROM users WHERE id = $1",
            [ticket.attendant_id],
          );
          attendantEmail = att.rows[0] ? att.rows[0].email : null;
        }

        // ── E-mail de conclusão ao solicitante (CC atendente) ──
        if (ticket.requester_email) {
          try {
            const payload = {
              from: `Painel V-CORP <${process.env.EMAIL_FROM}>`,
              to: ticket.requester_email,
              subject: `Chamado #${ticket.id} concluído - Painel V-CORP`,
              html: buildEmailHtml({
                heading: "Seu chamado foi concluído",
                greetingName: ticket.name || "solicitante",
                bodyHtml: `
                  <p>O seu chamado <strong>#${ticket.id}</strong> - "${escapeHtml(ticket.title)}", foi concluído.</p>
                  ${
                    ticket.resolution_notes
                      ? `<p><strong>Instruções de resolução:</strong></p>
                         <p style="background:#f8f9fa;border-left:4px solid #04a146;padding:12px 16px;border-radius:4px;white-space:pre-wrap;">${escapeHtml(
                           ticket.resolution_notes,
                         )}</p>`
                      : ""
                  }
                  <p style="font-size:14px;color:#6c757d;">Atendido por: ${escapeHtml(
                    ticket.attendant_name || "Equipe V-CORP",
                  )}</p>
                  ${trackButtonHtml(ticket.tracking_token)}
                `,
              }),
            };
            if (attendantEmail) payload.cc = [attendantEmail];

            await resend.emails.send(payload);
          } catch (mailErr) {
            console.warn("Falha ao enviar e-mail de conclusão:", mailErr);
          }
        }

        try {
          logActivity(
            req.user.id,
            req.user.email,
            "Atendimento Encerrado",
            `Ticket ID ${id} concluído por ${req.user.nome || req.user.email}.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log:", e);
        }

        res.json(ticket);
      } catch (err) {
        console.error("Erro ao encerrar atendimento:", err);
        res.status(500).json({ error: "Erro ao encerrar atendimento." });
      }
    },
  );

  // ── DELETE /api/tickets/:id ──────────────────────────────────────────────
  router.delete(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;

      try {
        const result = await pool.query(
          "DELETE FROM tickets WHERE id = $1 RETURNING title",
          [id],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "ticket não encontrado." });
        }

        try {
          logActivity(
            req.user.id,
            req.user.email,
            "Ticket Excluído",
            `Ticket "${result.rows[0].title}" (ID ${id}) excluído.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log:", e);
        }

        res.json({ success: true });
      } catch (err) {
        console.error("Erro ao excluir ticket:", err);
        res.status(500).json({ error: "Erro ao excluir ticket." });
      }
    },
  );

  return router;
};
