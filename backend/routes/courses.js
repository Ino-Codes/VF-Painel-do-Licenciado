const express = require("express");
const router = express.Router();
// Importamos nosso novo middleware de autenticação
const { isAdmin } = require("../middleware/auth.js");

module.exports = function (pool) {
  const checkAdmin = isAdmin(pool); // Inicializamos o middleware com a conexão do banco

  // ROTA PARA LISTAR TODOS OS CURSOS (apenas para admins)
  router.get("/", checkAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM courses ORDER BY created_at DESC"
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar cursos:", err);
      res.status(500).json({ error: "Erro ao buscar cursos." });
    }
  });

  // ROTA PARA CRIAR UM NOVO CURSO (apenas para admins)
  router.post("/", checkAdmin, async (req, res) => {
    const { title, description, thumbnail_url } = req.body;
    if (!title) {
      return res.status(400).json({ error: "O título é obrigatório." });
    }
    try {
      const result = await pool.query(
        "INSERT INTO courses (title, description, thumbnail_url) VALUES ($1, $2, $3) RETURNING *",
        [title, description, thumbnail_url]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao criar curso:", err);
      res.status(500).json({ error: "Erro ao criar curso." });
    }
  });

  // ROTA PARA ATUALIZAR UM CURSO (apenas para admins)
  router.put("/:id", checkAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, description, thumbnail_url, is_active } = req.body;
    try {
      const result = await pool.query(
        "UPDATE courses SET title = $1, description = $2, thumbnail_url = $3, is_active = $4 WHERE id = $5 RETURNING *",
        [title, description, thumbnail_url, is_active, id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Curso não encontrado." });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao atualizar curso:", err);
      res.status(500).json({ error: "Erro ao atualizar curso." });
    }
  });

  // ROTA PARA DELETAR UM CURSO (apenas para admins)
  router.delete("/:id", checkAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query("DELETE FROM courses WHERE id = $1", [
        id,
      ]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Curso não encontrado." });
      }
      res.status(204).send(); // 204 No Content - sucesso, sem corpo de resposta
    } catch (err) {
      console.error("Erro ao deletar curso:", err);
      res.status(500).json({ error: "Erro ao deletar curso." });
    }
  });

  return router;
};
