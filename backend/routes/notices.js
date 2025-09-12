const express = require("express");
const router = express.Router();
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

module.exports = function ({ pool, checkLoggedIn, checkAdmin }) {
  router.get("/", checkLoggedIn, async (req, res) => {
    const { role } = req.user;
    try {
      let query = "SELECT * FROM notices";
      const params = [];

      if (role === "licenciado") {
        query += " WHERE visibility = 'licenciados' OR visibility = 'todos'";
      } else {
        query += " WHERE visibility = 'internos' OR visibility = 'todos'";
      }

      query += " ORDER BY created_at DESC";
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar avisos:", err);
      res.status(500).json({ error: "Erro ao buscar avisos." });
    }
  });

  router.post("/admin", checkLoggedIn, checkAdmin, async (req, res) => {
    const { message, visibility } = req.body;
    try {
      const clean_message = DOMPurify.sanitize(message);
      await pool.query(
        "INSERT INTO notices (message, visibility) VALUES ($1, $2)",
        [clean_message, visibility]
      );
      res.status(201).json({ success: true });
    } catch (err) {
      console.error("Erro ao criar aviso:", err);
      res.status(500).json({ error: "Erro ao criar aviso." });
    }
  });

  router.put("/admin/:id", checkLoggedIn, checkAdmin, async (req, res) => {
    const { id } = req.params;
    const { message, visibility } = req.body;
    try {
      const clean_message = DOMPurify.sanitize(message);
      const result = await pool.query(
        "UPDATE notices SET message = $1, visibility = $2 WHERE id = $3 RETURNING *",
        [clean_message, visibility, id]
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
