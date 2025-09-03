const express = require("express");
const router = express.Router();

module.exports = function (pool) {
  // Rota para BUSCAR eventos (com filtro de data)
  router.get("/", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM events ORDER BY start_date ASC"
      );
      res.json(result.rows);
    } catch (err) {
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
      res.status(500).json({ error: "Erro ao criar evento." });
    }
  });

  // Rota para ATUALIZAR um evento
  router.put("/:id", async (req, res) => {
    // ... lógica para UPDATE
  });

  // Rota para DELETAR um evento
  router.delete("/:id", async (req, res) => {
    // ... lógica para DELETE
  });

  return router;
};
