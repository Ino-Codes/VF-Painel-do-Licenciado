const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

module.exports = function (pool, logActivity) {
  // Gera token seguro e único
  const generateToken = () => crypto.randomBytes(32).toString("hex");

  // ── GET /api/widget-tenants ───────────────────────────────────────────────
  router.get("/", isLoggedIn, checkRole(["admin"]), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT wt.*, u.nome AS created_by_name
         FROM widget_tenants wt
         LEFT JOIN users u ON wt.created_by = u.id
         ORDER BY wt.created_at DESC`,
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao listar tenants:", err);
      res.status(500).json({ error: "Erro ao listar tenants." });
    }
  });

  // ── POST /api/widget-tenants ──────────────────────────────────────────────
  router.post("/", isLoggedIn, checkRole(["admin"]), async (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Nome do sistema é obrigatório." });
    }

    const token = generateToken();

    try {
      const result = await pool.query(
        `INSERT INTO widget_tenants (name, token, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name.trim(), token, req.user.id],
      );

      try {
        logActivity(
          req.user.id,
          req.user.email,
          "WIDGET_TENANT_CRIADO",
          `Tenant "${name}" criado com token ${token.slice(0, 8)}...`,
          req.ipAddress,
        );
      } catch (e) {
        console.warn("Falha ao registrar log:", e);
      }

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao criar tenant:", err);
      res.status(500).json({ error: "Erro ao criar tenant." });
    }
  });

  // ── PUT /api/widget-tenants/:id ───────────────────────────────────────────
  router.put("/:id", isLoggedIn, checkRole(["admin"]), async (req, res) => {
    const { id } = req.params;
    const { name, active } = req.body;

    try {
      const result = await pool.query(
        `UPDATE widget_tenants
         SET name = $1, active = $2
         WHERE id = $3
         RETURNING *`,
        [name, active, id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Tenant não encontrado." });
      }

      try {
        logActivity(
          req.user.id,
          req.user.email,
          "WIDGET_TENANT_EDITADO",
          `Tenant ID ${id} atualizado. Ativo: ${active}.`,
          req.ipAddress,
        );
      } catch (e) {
        console.warn("Falha ao registrar log:", e);
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao editar tenant:", err);
      res.status(500).json({ error: "Erro ao editar tenant." });
    }
  });

  // ── DELETE /api/widget-tenants/:id ────────────────────────────────────────
  router.delete("/:id", isLoggedIn, checkRole(["admin"]), async (req, res) => {
    const { id } = req.params;

    try {
      const tenantResult = await pool.query(
        "SELECT name FROM widget_tenants WHERE id = $1",
        [id],
      );

      if (tenantResult.rowCount === 0) {
        return res.status(404).json({ error: "Tenant não encontrado." });
      }

      const { name } = tenantResult.rows[0];

      // tickets são deletados em cascata (ON DELETE CASCADE)
      await pool.query("DELETE FROM widget_tenants WHERE id = $1", [id]);

      try {
        logActivity(
          req.user.id,
          req.user.email,
          "WIDGET_TENANT_EXCLUIDO",
          `Tenant "${name}" (ID ${id}) excluído.`,
          req.ipAddress,
        );
      } catch (e) {
        console.warn("Falha ao registrar log:", e);
      }

      res.json({ success: true, message: "Tenant excluído com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir tenant:", err);
      res.status(500).json({ error: "Erro ao excluir tenant." });
    }
  });

  // ── POST /api/widget-tenants/:id/regenerate-token ────────────────────────
  router.post(
    "/:id/regenerate-token",
    isLoggedIn,
    checkRole(["admin"]),
    async (req, res) => {
      const { id } = req.params;
      const newToken = generateToken();

      try {
        const result = await pool.query(
          "UPDATE widget_tenants SET token = $1 WHERE id = $2 RETURNING *",
          [newToken, id],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Tenant não encontrado." });
        }

        try {
          logActivity(
            req.user.id,
            req.user.email,
            "WIDGET_TOKEN_REGENERADO",
            `Token do tenant ID ${id} foi regenerado.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log:", e);
        }

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao regenerar token:", err);
        res.status(500).json({ error: "Erro ao regenerar token." });
      }
    },
  );

  return router;
};
