// backend/routes/events.js

const express = require("express");
const router = express.Router();

module.exports = function (pool) {
  // --- NOVA ROTA PÚBLICA PARA O DASHBOARD ---
  router.get("/current-month", async (req, res) => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();

      // Define o primeiro e o último dia do mês corrente
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59); // Até ao final do dia

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

  // --- ROTAS DE ADMINISTRAÇÃO (EXISTENTES) ---

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

  // Rota para CRIAR um novo evento
  router.post("/", async (req, res) => {
    // 1. Adicionamos 'color' ao desestruturamento
    const { title, description, start_date, end_date, category, color } =
      req.body;
    try {
      const result = await pool.query(
        // 2. Adicionamos 'color' à query SQL
        "INSERT INTO events (title, description, start_date, end_date, category, color) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [title, description, start_date, end_date, category, color]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao criar evento:", err);
      res.status(500).json({ error: "Erro ao criar evento." });
    }
  });

  // Rota para ATUALIZAR um evento existente
  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    // 1. Adicionamos 'color' ao desestruturamento
    const { title, description, start_date, end_date, category, color } =
      req.body;
    try {
      const result = await pool.query(
        // 2. Adicionamos 'color' à query SQL
        "UPDATE events SET title = $1, description = $2, start_date = $3, end_date = $4, category = $5, color = $6 WHERE id = $7 RETURNING *",
        [title, description, start_date, end_date, category, color, id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Evento não encontrado." });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao atualizar evento:", err);
      res.status(500).json({ error: "Erro ao atualizar evento." });
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
