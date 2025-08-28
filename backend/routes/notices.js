const express = require("express");
const router = express.Router();

const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

module.exports = function (pool) {
  router.get("/", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM notices ORDER BY created_at DESC"
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar avisos:", err);
      res.status(500).json({ error: "Erro ao buscar avisos." });
    }
  });

  router.post("/admin", async (req, res) => {
    const { message } = req.body;
    try {
      const clean_message = DOMPurify.sanitize(message);

      await pool.query("INSERT INTO notices (message) VALUES ($1)", [
        clean_message,
      ]);
      res.status(201).json({ success: true });
    } catch (err) {
      console.error("Erro ao criar aviso:", err);
      res.status(500).json({ error: "Erro ao criar aviso." });
    }
  });

  router.put("/admin/:id", async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    try {
      const clean_message = DOMPurify.sanitize(message);

      const result = await pool.query(
        "UPDATE notices SET message = $1 WHERE id = $2 RETURNING *",
        [clean_message, id]
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Aviso não encontrado." });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao editar aviso:", err);
      res.status(500).json({ error: "Erro ao editar aviso." });
    }
  });

  router.delete("/admin/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query("DELETE FROM notices WHERE id = $1", [
        id,
      ]);
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Aviso não encontrado." });
      res.json({ success: true, message: "Aviso excluído com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir aviso:", err);
      res.status(500).json({ error: "Erro ao excluir aviso." });
    }
  });

  return router;
};
