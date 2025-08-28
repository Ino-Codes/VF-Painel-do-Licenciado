const express = require("express");
const router = express.Router();

module.exports = function (pool) {
  // --- ROTA DE BUSCA DOS VÍDEOS ATUALIZADA COM PAGINAÇÃO ---
  router.get("/", async (req, res) => {
    const { role, category, page = 1, limit = 4 } = req.query;
    try {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      let params = [];
      let whereClauses = [];

      if (role === "licenciado") {
        whereClauses.push("visibility = 'public'");
      }
      if (category) {
        params.push(category);
        whereClauses.push(`category = $${params.length}`);
      }
      const whereString =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const countSql = `SELECT COUNT(*) FROM videos ${whereString}`;

      const pagedParams = [...params, limit, offset];
      const videosSql = `SELECT * FROM videos ${whereString} ORDER BY created_at DESC LIMIT $${
        params.length + 1
      } OFFSET $${params.length + 2}`;

      const [countResult, videosResult] = await Promise.all([
        pool.query(countSql, params),
        pool.query(videosSql, pagedParams),
      ]);

      const totalCount = parseInt(countResult.rows[0].count, 10);

      res.json({
        videos: videosResult.rows,
        totalPages: Math.ceil(totalCount / limit),
      });
    } catch (err) {
      console.error("Erro ao buscar vídeos:", err);
      res.status(500).json({ error: "Erro ao buscar vídeos" });
    }
  });

  // Rota de busca das categorias
  router.get("/categories", async (req, res) => {
    const { role } = req.query;
    try {
      let sql =
        "SELECT DISTINCT category FROM videos WHERE category IS NOT NULL AND category != ''";

      if (role === "licenciado") {
        sql += " AND visibility = 'public'";
      }

      sql += " ORDER BY category ASC";

      const result = await pool.query(sql);
      res.json(result.rows.map((row) => row.category));
    } catch (err) {
      console.error("Erro ao buscar categorias de vídeos:", err);
      res.status(500).json({ error: "Erro ao buscar categorias." });
    }
  });

  // Rota de adição
  router.post("/", async (req, res) => {
    const { title, description, youtube_url, visibility, category } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO videos (title, description, youtube_url, visibility, category) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [title, description, youtube_url, visibility, category]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao adicionar vídeo:", err);
      res.status(500).json({ error: "Erro ao adicionar vídeo" });
    }
  });

  // Rota de edição
  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { title, description, youtube_url, visibility, category } = req.body;
    try {
      const result = await pool.query(
        "UPDATE videos SET title = $1, description = $2, youtube_url = $3, visibility = $4, category = $5 WHERE id = $6 RETURNING *",
        [title, description, youtube_url, visibility, category, id]
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Vídeo não encontrado." });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao editar vídeo:", err);
      res.status(500).json({ error: "Erro ao editar vídeo." });
    }
  });

  // Rota de exclusão
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
