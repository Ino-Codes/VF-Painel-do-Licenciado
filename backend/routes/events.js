// backend/routes/events.js

const express = require("express");
const router = express.Router();

module.exports = function (pool) {
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
    const { title, description, start_date, end_date, category } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO events (title, description, start_date, end_date, category) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [title, description, start_date, end_date, category]
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
    const { title, description, start_date, end_date, category } = req.body;
    try {
      const result = await pool.query(
        "UPDATE events SET title = $1, description = $2, start_date = $3, end_date = $4, category = $5 WHERE id = $6 RETURNING *",
        [title, description, start_date, end_date, category, id]
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

  // Rota para DELETAR um evento
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
