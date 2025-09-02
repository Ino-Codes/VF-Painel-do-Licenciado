// backend/routes/events.js
const express = require("express");
const router = express.Router();
const { isAdmin, isLoggedIn } = require("../middleware/auth.js");

module.exports = function (pool) {
  const checkAdmin = isAdmin(pool);
  const checkLoggedIn = isLoggedIn(pool);

  // Rota para buscar os eventos de um mês/ano específico
  router.get("/", checkLoggedIn, async (req, res) => {
    const { month, year } = req.query; // ex: month=8 (para Setembro), year=2025
    if (!month || !year) {
      return res.status(400).json({ error: "Mês e ano são obrigatórios." });
    }
    try {
      // Busca todos os eventos que ocorrem no mês e ano especificados
      const result = await pool.query(
        "SELECT id, title, details, event_date FROM events WHERE EXTRACT(MONTH FROM event_date) = $1 AND EXTRACT(YEAR FROM event_date) = $2 ORDER BY event_date ASC",
        [month, year]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar eventos:", err);
      res.status(500).json({ error: "Erro ao buscar eventos" });
    }
  });

  // Rota para um admin criar um novo evento
  router.post("/", checkAdmin, async (req, res) => {
    const { title, details, event_date } = req.body;
    const { id: userId } = req.user;
    try {
      const result = await pool.query(
        "INSERT INTO events (title, details, event_date, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
        [title, details, event_date, userId]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao criar evento:", err);
      res.status(500).json({ error: "Erro ao criar evento" });
    }
  });

  // Rotas para editar e apagar podem ser adicionadas aqui no futuro
  // router.put("/:id", checkAdmin, ...);
  // router.delete("/:id", checkAdmin, ...);

  return router;
};
