const express = require("express");
const router = express.Router();

module.exports = function (pool) {
  // GET /api/videos
  router.get("/", async (req, res) => {
    const { role } = req.query;
    try {
      let sql = "SELECT * FROM videos";
      if (role === "licenciado") {
        sql += " WHERE visibility = 'public'";
      }
      sql += " ORDER BY created_at DESC";

      const result = await pool.query(sql);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar vídeos:", err);
      res.status(500).json({ error: "Erro ao buscar vídeos" });
    }
  });

  // POST /api/videos
  router.post("/", async (req, res) => {
    const { title, description, youtube_url, visibility } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO videos (title, description, youtube_url, visibility) VALUES ($1, $2, $3, $4) RETURNING *",
        [title, description, youtube_url, visibility]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao adicionar vídeo:", err);
      res.status(500).json({ error: "Erro ao adicionar vídeo" });
    }
  });

  // PUT /api/videos/:id
  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { title, description, youtube_url, visibility } = req.body;
    try {
      const result = await pool.query(
        "UPDATE videos SET title = $1, description = $2, youtube_url = $3, visibility = $4 WHERE id = $5 RETURNING *",
        [title, description, youtube_url, visibility, id]
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Vídeo não encontrado." });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao editar vídeo:", err);
      res.status(500).json({ error: "Erro ao editar vídeo." });
    }
  });

  // DELETE /api/videos/:id
  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query("DELETE FROM videos WHERE id = $1", [id]);
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Vídeo não encontrado." });
      res.json({ success: true, message: "Vídeo excluído com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir vídeo:", err);
      res.status(500).json({ error: "Erro ao excluir vídeo." });
    }
  });

  return router;
};
