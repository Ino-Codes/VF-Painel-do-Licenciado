const express = require("express");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

module.exports = function (pool) {
  // Helper para buscar ID da empresa
  const getCompanyId = async (slug) => {
    if (!slug || slug === "undefined") return 1;
    try {
      const result = await pool.query(
        "SELECT id FROM companies WHERE slug = $1",
        [slug]
      );
      return result.rows.length > 0 ? result.rows[0].id : 1;
    } catch (error) {
      return 1;
    }
  };

  // Rota de busca dos vídeos
  router.get("/", isLoggedIn, async (req, res) => {
    const { company, category, page = 1, limit = 4 } = req.query;
    const { role } = req.user;

    try {
      // 1. Resolve ID da empresa
      const companyId = await getCompanyId(company);

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // O primeiro parâmetro será sempre o companyId
      let params = [companyId];
      let whereClauses = ["company_id = $1"]; // Filtro base

      // Filtros de Role
      if (role === "licenciado") {
        whereClauses.push(
          "(visibility = 'todos' OR visibility = 'licenciados')"
        );
      } else if (role !== "admin") {
        whereClauses.push("(visibility = 'todos' OR visibility = 'internos')");
      }
      // admin vê todos os vídeos independente da visibilidade

      // Filtro de Categoria
      if (category) {
        params.push(category);
        whereClauses.push(`category = $${params.length}`); // $2 se category existir
      }

      const whereString = `WHERE ${whereClauses.join(" AND ")}`;

      const countSql = `SELECT COUNT(*) FROM videos ${whereString}`;

      // Paginação usa os próximos índices disponíveis
      const limitIndex = params.length + 1;
      const offsetIndex = params.length + 2;

      const videosSql = `SELECT * FROM videos ${whereString} ORDER BY created_at DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`;

      const pagedParams = [...params, limit, offset];

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
  router.get("/categories", isLoggedIn, async (req, res) => {
    const { role } = req.user;
    const { company } = req.query; // Recebe company

    try {
      const companyId = await getCompanyId(company);

      // Base da query com filtro de empresa
      let baseSql =
        "SELECT DISTINCT category FROM videos WHERE company_id = $1 AND category IS NOT NULL AND category != ''";
      let whereClause = "";

      if (role === "licenciado") {
        whereClause =
          "AND (visibility = 'todos' OR visibility = 'licenciados')";
      } else if (role !== "admin") {
        whereClause = "AND (visibility = 'todos' OR visibility = 'internos')";
      }

      const finalSql = `${baseSql} ${whereClause} ORDER BY category ASC`;

      const result = await pool.query(finalSql, [companyId]);
      res.json(result.rows.map((row) => row.category));
    } catch (err) {
      console.error("Erro ao buscar categorias de vídeos:", err);
      res.status(500).json({ error: "Erro ao buscar categorias." });
    }
  });

  // Rota de adição
  router.post("/", isLoggedIn, checkRole(["admin", "rh"]), async (req, res) => {
    const { title, description, youtube_url, visibility, category, company } =
      req.body;
    try {
      const companyId = await getCompanyId(company);

      const result = await pool.query(
        "INSERT INTO videos (title, description, youtube_url, visibility, category, company_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [title, description, youtube_url, visibility, category, companyId]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao adicionar vídeo:", err);
      res.status(500).json({ error: "Erro ao adicionar vídeo" });
    }
  });

  // Rota de edição (Mantida igual - não altera empresa na edição)
  router.put(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { title, description, youtube_url, visibility, category } =
        req.body;
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
    }
  );

  // Rota de exclusão (Mantida igual)
  router.delete(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      try {
        const result = await pool.query("DELETE FROM videos WHERE id = $1", [
          id,
        ]);
        if (result.rowCount === 0)
          return res.status(404).json({ error: "Vídeo não encontrado." });
        res.json({ success: true, message: "Vídeo excluído com sucesso." });
      } catch (err) {
        console.error("Erro ao excluir vídeo:", err);
        res.status(500).json({ error: "Erro ao excluir vídeo." });
      }
    }
  );

  return router;
};
