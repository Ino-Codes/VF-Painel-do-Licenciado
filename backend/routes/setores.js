const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/auth.js");

module.exports = function (pool) {
  // Lista todos os setores (tabela de lookup normalizada).
  router.get("/", isLoggedIn, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, nome FROM setores ORDER BY nome ASC",
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar setores:", err);
      res.status(500).json({ error: "Erro ao buscar setores" });
    }
  });

  return router;
};
