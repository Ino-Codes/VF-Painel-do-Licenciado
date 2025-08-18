const express = require("express");
const router = express.Router();
const { isAdmin, isLoggedIn } = require("../middleware/auth.js");

module.exports = function (pool) {
  const checkAdmin = isAdmin(pool);

  // --- ROTAS DE CURSOS (Trilhas) ---

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

  router.get("/:id", checkAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      // Busca o curso principal
      const courseResult = await pool.query(
        "SELECT * FROM courses WHERE id = $1",
        [id]
      );
      if (courseResult.rowCount === 0) {
        return res.status(404).json({ error: "Curso não encontrado." });
      }
      const course = courseResult.rows[0];

      // Busca os módulos do curso
      const modulesResult = await pool.query(
        "SELECT * FROM modules WHERE course_id = $1 ORDER BY module_order ASC",
        [id]
      );
      const modules = modulesResult.rows;

      // Para cada módulo, busca suas aulas
      for (const module of modules) {
        const lessonsResult = await pool.query(
          "SELECT * FROM lessons WHERE module_id = $1 ORDER BY lesson_order ASC",
          [module.id]
        );
        module.lessons = lessonsResult.rows;
      }

      course.modules = modules;
      res.json(course);
    } catch (err) {
      console.error("Erro ao buscar detalhes do curso:", err);
      res.status(500).json({ error: "Erro ao buscar detalhes do curso." });
    }
  });

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

  router.delete("/:id", checkAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query("DELETE FROM courses WHERE id = $1", [
        id,
      ]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Curso não encontrado." });
      }
      res.status(204).send();
    } catch (err) {
      console.error("Erro ao deletar curso:", err);
      res.status(500).json({ error: "Erro ao deletar curso." });
    }
  });

  // --- ROTAS PARA MÓDULOS ---

  router.post("/:courseId/modules", checkAdmin, async (req, res) => {
    const { courseId } = req.params;
    const { title, module_order } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO modules (course_id, title, module_order) VALUES ($1, $2, $3) RETURNING *",
        [courseId, title, module_order]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao criar módulo:", err);
      res.status(500).json({ error: "Erro ao criar módulo." });
    }
  });

  router.delete("/modules/:moduleId", checkAdmin, async (req, res) => {
    const { moduleId } = req.params;
    try {
      await pool.query("DELETE FROM modules WHERE id = $1", [moduleId]);
      res.status(204).send();
    } catch (err) {
      console.error("Erro ao deletar módulo:", err);
      res.status(500).json({ error: "Erro ao deletar módulo." });
    }
  });

  // --- ROTAS PARA AULAS ---

  router.post("/modules/:moduleId/lessons", checkAdmin, async (req, res) => {
    const { moduleId } = req.params;
    const { title, content_type, content_data, lesson_order } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO lessons (module_id, title, content_type, content_data, lesson_order) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [moduleId, title, content_type, content_data, lesson_order]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao criar aula:", err);
      res.status(500).json({ error: "Erro ao criar aula." });
    }
  });

  router.delete("/lessons/:lessonId", checkAdmin, async (req, res) => {
    const { lessonId } = req.params;
    try {
      await pool.query("DELETE FROM lessons WHERE id = $1", [lessonId]);
      res.status(204).send();
    } catch (err) {
      console.error("Erro ao deletar aula:", err);
      res.status(500).json({ error: "Erro ao deletar aula." });
    }
  });

  // --- ROTAS PARA ALUNOS ---

  const checkLoggedIn = isLoggedIn(pool);

  router.get("/public", checkLoggedIn, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM courses WHERE is_active = TRUE ORDER BY title ASC"
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar cursos públicos:", err);
      res.status(500).json({ error: "Erro ao buscar cursos." });
    }
  });

  router.post(
    "/lessons/:lessonId/complete",
    checkLoggedIn,
    async (req, res) => {
      const { lessonId } = req.params;
      const { id: userId } = req.user;

      try {
        await pool.query(
          "INSERT INTO progress (user_id, lesson_id) VALUES ($1, $2) ON CONFLICT (user_id, lesson_id) DO NOTHING",
          [userId, lessonId]
        );
        res.status(200).json({ message: "Progresso salvo com sucesso." });
      } catch (err) {
        console.error("Erro ao salvar progresso:", err);
        res.status(500).json({ error: "Erro ao salvar progresso." });
      }
    }
  );

  return router;
};
