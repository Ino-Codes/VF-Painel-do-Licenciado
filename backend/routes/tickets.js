const express = require("express");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

const VALID_STATUSES = [
  "novo",
  "analise",
  "andamento",
  "concluido",
  "arquivado",
];
const VALID_TYPES = ["help", "suggestion", "bug"];

module.exports = function (pool, logActivity) {
  // ── POST /api/ticket (público — chamado pelo widget) ────────────────────
  router.post("/", async (req, res) => {
    const { token, type, name, title, description, origin_url } = req.body;

    if (!token || !title) {
      return res
        .status(400)
        .json({ error: "Token e título são obrigatórios." });
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

      const result = await pool.query(
        `INSERT INTO tickets (tenant_id, type, title, description, origin_url, name)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [tenantId, type, title, description, origin_url, name],
      );

      res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (err) {
      console.error("Erro ao salvar ticket:", err);
      res.status(500).json({ error: "Erro ao salvar ticket." });
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

  // ── PATCH /api/tickets/:id (atualiza status — drag and drop) ────────────
  router.patch(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Status inválido." });
      }

      try {
        const result = await pool.query(
          "UPDATE tickets SET status = $1 WHERE id = $2 RETURNING *",
          [status, id],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "ticket não encontrado." });
        }

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao atualizar status:", err);
        res.status(500).json({ error: "Erro ao atualizar status." });
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
