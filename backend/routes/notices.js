const express = require("express");
const router = express.Router();

const { isLoggedIn, isAdmin, checkRole } = require("../middleware/auth.js");

module.exports = function (pool, createNotification, logActivity) {
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
    const { message, visibility } = req.body;
    const creatorId = req.user.id;

    try {
      const result = await pool.query(
        "INSERT INTO notices (message, visibility) VALUES ($1, $2) RETURNING *",
        [message, visibility]
      );

      try {
        let targetUsersQuery = "";
        const params = [creatorId];

        if (visibility === "todos") {
          targetUsersQuery = "SELECT id FROM users WHERE id != $1";
        } else if (visibility === "licenciados") {
          targetUsersQuery =
            "SELECT id FROM users WHERE role = 'licenciado' AND id != $1";
        } else if (visibility === "internos") {
          targetUsersQuery =
            "SELECT id FROM users WHERE role IN ('admin', 'rh', 'comercial', 'operacional') AND id != $1";
        }

        if (targetUsersQuery) {
          const targetUsers = await pool.query(targetUsersQuery, params);
          const notificationMessage = "Um novo aviso foi postado no mural.";

          for (const user of targetUsers.rows) {
            createNotification(user.id, notificationMessage, "/home");
          }
        }
      } catch (notifyErr) {
        console.error("Erro ao criar notificações de aviso:", notifyErr);
      }

      try {
        await logActivity(
          req.user?.id || null,
          req.user?.email || "desconhecido",
          "Aviso Criada",
          `Foi postado um novo aviso.`,
          req.ipAddress
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
          [message, visibility, id]
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
            req.ipAddress
          );
        } catch (e) {
          console.warn("Falha ao registrar log de edição:", e);
        }
      } catch (err) {
        console.error("Erro ao editar aviso:", err);
        res.status(500).json({ error: "Erro ao editar aviso." });
      }
    }
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
            req.ipAddress
          );
        } catch (e) {
          console.warn("Falha ao registrar log de exclusão:", e);
        }
      } catch (err) {
        console.error("Erro ao excluir aviso:", err);
        res.status(500).json({ error: "Erro ao excluir aviso." });
      }
    }
  );

  return router;
};
