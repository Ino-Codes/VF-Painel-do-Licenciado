const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/auth.js");

module.exports = function (pool) {
  // Rota para buscar as notificações DO UTILIZADOR LOGADO
  router.get("/", isLoggedIn, async (req, res) => {
    const { id: userId } = req.user;
    try {
      // Busca as 10 notificações mais recentes
      const result = await pool.query(
        "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar notificações:", err);
      res.status(500).json({ error: "Erro ao buscar notificações." });
    }
  });

  // Rota para marcar todas as notificações do utilizador como lidas
  router.post("/mark-read", isLoggedIn, async (req, res) => {
    const { id: userId } = req.user;
    try {
      await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
        [userId]
      );
      res.json({ success: true, message: "Notificações marcadas como lidas." });
    } catch (err) {
      console.error("Erro ao marcar notificações:", err);
      res.status(500).json({ error: "Erro ao marcar notificações." });
    }
  });

  return router;
};
