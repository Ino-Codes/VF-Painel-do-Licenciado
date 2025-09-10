const express = require("express");
const router = express.Router();
const { isAdmin, isLoggedIn } = require("../middleware/auth.js");

module.exports = function (pool, cloudinary, upload) {
  const checkAdmin = isAdmin(pool);
  const checkLoggedIn = isLoggedIn(pool);

  // ROTA PÚBLICA PARA O DASHBOARD
  router.get("/current-month", async (req, res) => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();

      // Define o primeiro e o último dia do mês corrente
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

      const result = await pool.query(
        "SELECT * FROM events WHERE start_date >= $1 AND start_date <= $2 ORDER BY start_date ASC",
        [firstDayOfMonth, lastDayOfMonth]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar eventos do mês:", err);
      res.status(500).json({ error: "Erro ao buscar eventos do mês." });
    }
  });

  // ROTA PARA BUSCAR USUÁRIOS (para o modal)
  router.get(
    "/users-for-notification",
    checkLoggedIn,
    checkAdmin,
    async (req, res) => {
      try {
        const result = await pool.query(
          "SELECT id, nome, email FROM users WHERE role != 'licenciado' ORDER BY nome ASC"
        );
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: "Erro ao buscar usuários." });
      }
    }
  );

  // ROTA PARA BUSCAR NOTIFICADOS DE UM EVENTO ESPECÍFICO
  router.get(
    "/:id/notified-users",
    checkLoggedIn,
    checkAdmin,
    async (req, res) => {
      const { id } = req.params;
      try {
        const result = await pool.query(
          "SELECT user_id FROM event_notifications WHERE event_id = $1",
          [id]
        );
        res.json(result.rows.map((row) => row.user_id));
      } catch (err) {
        res.status(500).json({ error: "Erro ao buscar usuários notificados." });
      }
    }
  );

  // ROTAS DE ADMINISTRAÇÃO

  // Rota para BUSCAR todos os eventos
  router.get("/", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM events ORDER BY start_date ASC"
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar eventos:", err);
      res.status(500).json({ error: "Erro ao buscar eventos." });
    }
  });

  // Rota para BUSCAR as categorias
  router.get("/categories", checkLoggedIn, checkAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT DISTINCT category FROM events WHERE category IS NOT NULL AND category != '' ORDER BY category ASC"
      );
      res.json(result.rows.map((row) => row.category));
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar categorias de eventos." });
    }
  });

  // Rota para CRIAR um novo evento
  router.post("/", checkLoggedIn, checkAdmin, async (req, res) => {
    const {
      title,
      description,
      start_date,
      end_date,
      category,
      color,
      notifiedUserIds,
    } = req.body;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const eventResult = await client.query(
        "INSERT INTO events (title, description, start_date, end_date, category, color) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        [title, description, start_date, end_date, category, color]
      );
      const newEventId = eventResult.rows[0].id;

      if (notifiedUserIds && notifiedUserIds.length > 0) {
        for (const userId of notifiedUserIds) {
          await client.query(
            "INSERT INTO event_notifications (event_id, user_id) VALUES ($1, $2)",
            [newEventId, userId]
          );
        }
      }
      await client.query("COMMIT");
      res.status(201).json({ id: newEventId });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Erro ao criar evento." });
    } finally {
      client.release();
    }
  });

  // Rota para ATUALIZAR um evento existente
  router.put("/:id", checkLoggedIn, checkAdmin, async (req, res) => {
    const { id } = req.params;
    const {
      title,
      description,
      start_date,
      end_date,
      category,
      color,
      notifiedUserIds,
    } = req.body;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE events SET title = $1, description = $2, start_date = $3, end_date = $4, category = $5, color = $6 WHERE id = $7",
        [title, description, start_date, end_date, category, color, id]
      );

      await client.query(
        "DELETE FROM event_notifications WHERE event_id = $1",
        [id]
      );

      if (notifiedUserIds && notifiedUserIds.length > 0) {
        for (const userId of notifiedUserIds) {
          await client.query(
            "INSERT INTO event_notifications (event_id, user_id) VALUES ($1, $2)",
            [id, userId]
          );
        }
      }
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Erro ao atualizar evento." });
    } finally {
      client.release();
    }
  });

  // Rota para DELETAR um evento (não precisa de alterações)
  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query("DELETE FROM events WHERE id = $1", [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Evento não encontrado." });
      }
      res.json({ success: true, message: "Evento excluído com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir evento:", err);
      res.status(500).json({ error: "Erro ao excluir evento." });
    }
  });

  return router;
};
