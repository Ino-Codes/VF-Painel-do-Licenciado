const express = require("express");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

module.exports = function (pool, cloudinary, upload) {
  // ROTA PÚBLICA PARA O DASHBOARD
  router.get("/current-month", isLoggedIn, async (req, res) => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

      const query = `
                SELECT * FROM events 
                WHERE end_date >= $1 
                AND end_date <= $2 
                ORDER BY start_date ASC
            `;

      const result = await pool.query(query, [now, lastDayOfMonth]);

      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar eventos do mês:", err);
      res.status(500).json({ error: "Erro ao buscar eventos do mês." });
    }
  });

  // ROTA PARA BUSCAR USUÁRIOS (para o modal)
  router.get(
    "/users-for-notification",
    isLoggedIn,
    checkRole(["admin", "rh"]),
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
    isLoggedIn,
    checkRole(["admin", "rh"]),
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

  // Rota para BUSCAR todos os eventos
  router.get("/", isLoggedIn, async (req, res) => {
    const userId = req.user.id; // Obtém o ID do utilizador logado

    try {
      // Busca os eventos comuns da tabela 'events'
      const eventsResult = await pool.query(
        "SELECT * FROM events ORDER BY start_date ASC"
      );
      const regularEvents = eventsResult.rows.map((event) => ({
        id: `event-${event.id}`, // Prefixo para evitar conflito de ID
        title: event.title,
        start: event.start_date,
        end: event.end_date,
        backgroundColor: event.color || "#daa520", // Cor padrão
        borderColor: event.color || "#daa520",
        extendedProps: {
          type: "event", // Identificador do tipo
          description: event.description,
          category: event.category,
        },
      }));

      // Busca os pedidos de férias DO UTILIZADOR LOGADO
      const vacationResult = await pool.query(
        `SELECT * FROM vacation_requests WHERE user_id = $1 ORDER BY start_date ASC`,
        [userId]
      );

      const statusColors = {
        Pendente: "#daa520", // Dourado
        Aprovado: "#28a745", // Verde
        Recusado: "#dc3545", // Vermelho
      };

      const vacationEvents = vacationResult.rows.map((req) => ({
        id: `vacation-${req.id}`, // Prefixo para evitar conflito de ID
        title: `Férias ${req.status}`, // Título indica o status
        start: req.start_date,
        // Adiciona 1 dia ao end_date para exibição correta no FullCalendar (dia inteiro)
        end: new Date(
          new Date(req.end_date).setDate(new Date(req.end_date).getDate() + 1)
        )
          .toISOString()
          .split("T")[0],
        allDay: true, // Férias são eventos de dia inteiro
        backgroundColor: statusColors[req.status] || "#6c757d",
        borderColor: statusColors[req.status] || "#6c757d",
        extendedProps: {
          type: "vacation", // Identificador do tipo
          dias_solicitados: req.dias_solicitados,
          observacao: req.observacao,
          status: req.status,
        },
      }));

      const allEvents = [...regularEvents, ...vacationEvents];

      res.json(allEvents);
    } catch (err) {
      console.error("Erro ao buscar eventos e férias:", err);
      res.status(500).json({ error: "Erro ao buscar eventos e férias." });
    }
  });

  // Rota para BUSCAR as categorias
  router.get(
    "/categories",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      try {
        const result = await pool.query(
          "SELECT DISTINCT category FROM events WHERE category IS NOT NULL AND category != '' ORDER BY category ASC"
        );
        res.json(result.rows.map((row) => row.category));
      } catch (err) {
        res
          .status(500)
          .json({ error: "Erro ao buscar categorias de eventos." });
      }
    }
  );

  // Rota para CRIAR um novo evento
  router.post("/", isLoggedIn, checkRole(["admin", "rh"]), async (req, res) => {
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
  router.put(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
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
    }
  );

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
