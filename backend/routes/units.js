const express = require("express");
const router = express.Router();

module.exports = function (pool) {
  // Lista todas as unidades
  router.get("/", async (req, res) => {
    try {
      const result = await pool.query("SELECT id, name FROM units ORDER BY id");
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar unidades:", err);
      res.status(500).json({ error: "Erro ao buscar unidades" });
    }
  });

  return router;
};
