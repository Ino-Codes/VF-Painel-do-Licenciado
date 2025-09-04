const express = require("express");
const router = express.Router();
const { isAdmin, isLoggedIn } = require("../middleware/auth.js");
const puppeteer = require("puppeteer");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
const crypto = require("crypto");
const path = require("path");

module.exports = function (pool, cloudinary, upload) {
  const checkAdmin = isAdmin(pool);
  const checkLoggedIn = isLoggedIn(pool);

  // --- ROTAS PÚBLICAS (PARA ALUNOS) ---
  router.get("/public", checkLoggedIn, async (req, res) => {
    const { id: userId } = req.user;
    try {
      const query = `
        SELECT
          c.*,
          COUNT(DISTINCT l.id)::int AS total_lessons,
          COUNT(DISTINCT p.id)::int AS completed_lessons
        FROM
          courses c
        LEFT JOIN
          modules m ON m.course_id = c.id
        LEFT JOIN
          lessons l ON l.module_id = m.id
        LEFT JOIN
          progress p ON p.lesson_id = l.id AND p.user_id = $1
        WHERE
          c.is_active = TRUE
        GROUP BY
          c.id
        ORDER BY
          c.title ASC;
      `;
      const result = await pool.query(query, [userId]);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar cursos públicos:", err);
      res.status(500).json({ error: "Erro ao buscar cursos." });
    }
  });

  router.get("/public/:id", checkLoggedIn, async (req, res) => {
    const { id: courseId } = req.params;
    const { id: userId } = req.user;
    try {
      const courseQuery = `
            SELECT c.*,
                COALESCE(
                    (SELECT json_agg(m_agg) FROM (
                        SELECT m.*,
                            COALESCE(
                                (SELECT json_agg(l_agg) FROM (
                                    SELECT l.* FROM lessons l
                                    WHERE l.module_id = m.id
                                    ORDER BY l.lesson_order ASC
                                ) AS l_agg),
                            '[]') AS lessons
                        FROM modules m
                        WHERE m.course_id = c.id
                        ORDER BY m.module_order ASC
                    ) AS m_agg),
                '[]') AS modules
            FROM courses c
            WHERE c.id = $1 AND c.is_active = TRUE
        `;
      const courseResult = await pool.query(courseQuery, [courseId]);

      if (courseResult.rowCount === 0) {
        return res
          .status(404)
          .json({ error: "Curso não encontrado ou inativo." });
      }
      const course = courseResult.rows[0];

      const progressQuery = `
            SELECT p.lesson_id FROM progress p
            JOIN lessons l ON p.lesson_id = l.id
            JOIN modules m ON l.module_id = m.id
            WHERE p.user_id = $1 AND m.course_id = $2
        `;
      const progressResult = await pool.query(progressQuery, [
        userId,
        courseId,
      ]);
      course.completedLessons = progressResult.rows.map((row) => row.lesson_id);

      const quizQuery = `
            SELECT 
                q.id AS quiz_id,
                EXISTS (
                    SELECT 1 FROM quiz_attempts qa 
                    WHERE qa.quiz_id = q.id AND qa.user_id = $1 AND qa.passed = TRUE
                ) AS has_passed_quiz
            FROM quizzes q
            WHERE q.course_id = $2
        `;
      const quizResult = await pool.query(quizQuery, [userId, courseId]);
      if (quizResult.rowCount > 0) {
        course.quiz_id = quizResult.rows[0].quiz_id;
        course.has_passed_quiz = quizResult.rows[0].has_passed_quiz;
      } else {
        course.quiz_id = null;
        course.has_passed_quiz = false;
      }

      res.json(course);
    } catch (err) {
      console.error("Erro ao buscar detalhes do curso para o aluno:", err);
      res.status(500).json({ error: "Erro ao buscar detalhes do curso." });
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

  router.delete(
    "/lessons/:lessonId/progress",
    checkLoggedIn,
    async (req, res) => {
      const { lessonId } = req.params;
      const { id: userId } = req.user;
      try {
        await pool.query(
          "DELETE FROM progress WHERE user_id = $1 AND lesson_id = $2",
          [userId, lessonId]
        );
        res.status(200).json({ message: "Progresso removido." });
      } catch (err) {
        console.error("Erro ao remover progresso:", err);
        res.status(500).json({ error: "Erro ao remover progresso." });
      }
    }
  );

  // --- ROTAS DE ADMINISTRAÇÃO ---

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
      const courseResult = await pool.query(
        "SELECT * FROM courses WHERE id = $1",
        [id]
      );
      if (courseResult.rowCount === 0) {
        return res.status(404).json({ error: "Curso não encontrado." });
      }
      const course = courseResult.rows[0];

      // Busca Módulos e Aulas
      const modulesResult = await pool.query(
        "SELECT * FROM modules WHERE course_id = $1 ORDER BY module_order ASC",
        [id]
      );
      const modules = modulesResult.rows;
      for (const module of modules) {
        const lessonsResult = await pool.query(
          "SELECT id, module_id, title, video_url, text_content, lesson_order FROM lessons WHERE module_id = $1 ORDER BY lesson_order ASC",
          [module.id]
        );
        module.lessons = lessonsResult.rows;
      }
      course.modules = modules;

      // --- NOVA LÓGICA PARA BUSCAR O QUIZ COMPLETO PARA O ADMIN ---
      const quizResult = await pool.query(
        "SELECT * FROM quizzes WHERE course_id = $1",
        [id]
      );
      if (quizResult.rowCount > 0) {
        const quiz = quizResult.rows[0];
        const questionsResult = await pool.query(
          "SELECT * FROM questions WHERE quiz_id = $1 ORDER BY id ASC",
          [quiz.id]
        );
        const questions = questionsResult.rows;

        for (const question of questions) {
          const optionsResult = await pool.query(
            "SELECT * FROM options WHERE question_id = $1 ORDER BY id ASC",
            [question.id]
          );
          question.options = optionsResult.rows;
        }
        quiz.questions = questions;
        course.quiz = quiz;
      } else {
        course.quiz = null;
      }
      // --- FIM DA NOVA LÓGICA ---

      res.json(course);
    } catch (err) {
      console.error("Erro ao buscar detalhes do curso:", err);
      res.status(500).json({ error: "Erro ao buscar detalhes do curso." });
    }
  });

  router.post("/", checkAdmin, async (req, res) => {
    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ error: "O título é obrigatório." });
    }
    try {
      const result = await pool.query(
        "INSERT INTO courses (title, description) VALUES ($1, $2) RETURNING *",
        [title, description]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao criar curso:", err);
      res.status(500).json({ error: "Erro ao criar curso." });
    }
  });

  router.put("/:id", checkAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, description, is_active } = req.body;
    try {
      const result = await pool.query(
        "UPDATE courses SET title = $1, description = $2, is_active = $3 WHERE id = $4 RETURNING *",
        [title, description, is_active, id]
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

  router.post(
    "/:courseId/thumbnail",
    checkAdmin,
    upload.single("thumbnail"),
    async (req, res) => {
      const { courseId } = req.params;
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "Nenhum arquivo de imagem enviado." });
      }
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ resource_type: "image" }, (error, result) => {
              if (error) reject(error);
              resolve(result);
            })
            .end(req.file.buffer);
        });

        const newThumbnailUrl = uploadResult.secure_url;
        await pool.query(
          "UPDATE courses SET thumbnail_url = $1 WHERE id = $2",
          [newThumbnailUrl, courseId]
        );

        res.json({ success: true, thumbnailUrl: newThumbnailUrl });
      } catch (err) {
        console.error("Erro no upload da thumbnail:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      }
    }
  );

  // --- ROTA DE GERAÇÃO DE CERTIFICADO ---
  router.get("/:courseId/certificate", checkLoggedIn, async (req, res) => {
    const { courseId } = req.params;
    const { id: userId } = req.user;

    try {
      const userResult = await pool.query(
        "SELECT nome FROM users WHERE id = $1",
        [userId]
      );
      if (userResult.rowCount === 0) {
        return res.status(404).send("Utilizador não encontrado.");
      }
      const userName = userResult.rows[0].nome;

      const progressQuery = `SELECT COUNT(DISTINCT l.id)::int AS total, COUNT(DISTINCT p.id)::int AS completed FROM courses c JOIN modules m ON m.course_id = c.id JOIN lessons l ON l.module_id = m.id LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = $1 WHERE c.id = $2 GROUP BY c.id`;
      const progressResult = await pool.query(progressQuery, [
        userId,
        courseId,
      ]);

      if (
        progressResult.rowCount === 0 ||
        (progressResult.rows[0].total > 0 &&
          progressResult.rows[0].completed < progressResult.rows[0].total)
      ) {
        return res.status(403).send("Curso ainda não concluído.");
      }

      // 1. Buscamos também a URL do novo modelo de certificado
      const courseResult = await pool.query(
        "SELECT title, certificate_template_url FROM courses WHERE id = $1",
        [courseId]
      );
      const course = courseResult.rows[0];

      if (!course) {
        return res.status(404).send("Curso não encontrado.");
      }

      // 2. Lógica para usar o modelo personalizado ou o padrão
      const backgroundImageUrl = course.certificate_template_url
        ? course.certificate_template_url
        : "https://res.cloudinary.com/dsgbgrll5/image/upload/v1755866406/de_Conclusa%CC%83o_efsbh3.png"; // URL padrão

      const completionDate = new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      // 3. Usamos a variável `backgroundImageUrl` no estilo do HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Montserrat', sans-serif; margin: 0; padding: 0; }
            .certificate-wrapper { 
                width: 1123px; height: 794px; /* A4 Landscape */
                background-image: url("${backgroundImageUrl}");
                background-size: cover; background-position: center;
                display: flex; justify-content: center; align-items: center;
                box-sizing: border-box; 
            }
            .certificate-content { text-align: center; color: #0D0D0D; }
            /* ... (o resto do CSS do certificado continua o mesmo) ... */
          </style>
        </head>
        <body>
          <div class="certificate-wrapper">
            <div class="certificate-content">
                <h1>Certificado de Conclusão</h1>
                <p>Este certificado é concedido a</p>
                <div class="student-name">${userName}</div>
                <p>pela conclusão bem-sucedida do Curso: <strong>${course.title}</strong></p>
                <div class="footer"><p>Concluído em ${completionDate}</p></div>
            </div>
          </div>
        </body>
        </html>
      `;

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });
      const pdfBytes = await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
      });
      await browser.close();

      const uniqueCode = crypto.randomBytes(16).toString("hex");

      const insertCertificateQuery = `
        INSERT INTO certificates (user_id, course_id, unique_code, issue_date)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, course_id) 
        DO UPDATE SET issue_date = NOW();
      `;
      await pool.query(insertCertificateQuery, [userId, courseId, uniqueCode]);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="certificado-${course.title}.pdf"`
      );
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      console.error("Erro ao gerar certificado:", err);
      res.status(500).send("Erro ao gerar certificado.");
    }
  });

  // --- ROTAS DE ADMINISTRAÇÃO ---
  // ... (outras rotas de admin continuam as mesmas)

  router.post(
    "/:courseId/thumbnail",
    checkAdmin,
    upload.single("thumbnail"),
    async (req, res) => {
      const { courseId } = req.params;
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "Nenhum arquivo de imagem enviado." });
      }
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ resource_type: "image" }, (error, result) => {
              if (error) reject(error);
              resolve(result);
            })
            .end(req.file.buffer);
        });

        const newThumbnailUrl = uploadResult.secure_url;
        await pool.query(
          "UPDATE courses SET thumbnail_url = $1 WHERE id = $2",
          [newThumbnailUrl, courseId]
        );

        res.json({ success: true, thumbnailUrl: newThumbnailUrl });
      } catch (err) {
        console.error("Erro no upload da thumbnail:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      }
    }
  );

  router.post(
    "/:courseId/certificate-template",
    checkAdmin,
    upload.single("template"),
    async (req, res) => {
      const { courseId } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo PDF enviado." });
      }

      try {
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ resource_type: "image" }, (error, result) => {
              if (error) reject(error);
              resolve(result);
            })
            .end(req.file.buffer);
        });

        const newTemplateUrl = uploadResult.secure_url;
        await pool.query(
          "UPDATE courses SET certificate_template_url = $1 WHERE id = $2",
          [newTemplateUrl, courseId]
        );

        res.json({ success: true, templateUrl: newTemplateUrl });
      } catch (err) {
        console.error("Erro no upload do modelo de certificado:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      }
    }
  );

  // --- Módulos ---
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

  router.put("/:courseId/modules/order", checkAdmin, async (req, res) => {
    const { orderedModuleIds } = req.body;
    try {
      const client = await pool.connect();
      await client.query("BEGIN");
      for (let i = 0; i < orderedModuleIds.length; i++) {
        const moduleId = orderedModuleIds[i];
        const newOrder = i + 1;
        await client.query(
          "UPDATE modules SET module_order = $1 WHERE id = $2",
          [newOrder, moduleId]
        );
      }
      await client.query("COMMIT");
      client.release();
      res.status(200).json({ message: "Ordem dos módulos atualizada." });
    } catch (err) {
      console.error("Erro ao reordenar módulos:", err);
      res.status(500).json({ error: "Erro ao reordenar módulos." });
    }
  });

  // --- Aulas ---
  router.post("/modules/:moduleId/lessons", checkAdmin, async (req, res) => {
    const { moduleId } = req.params;
    const { title, video_url, text_content, lesson_order } = req.body;

    const clean_text_content = DOMPurify.sanitize(text_content);

    try {
      const result = await pool.query(
        "INSERT INTO lessons (module_id, title, video_url, text_content, lesson_order) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [moduleId, title, video_url, clean_text_content, lesson_order]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao criar aula:", err);
      res.status(500).json({ error: "Erro ao criar aula." });
    }
  });

  router.put("/lessons/:lessonId", checkAdmin, async (req, res) => {
    const { lessonId } = req.params;
    const { title, video_url, text_content } = req.body;

    const clean_text_content = DOMPurify.sanitize(text_content);

    try {
      const result = await pool.query(
        "UPDATE lessons SET title = $1, video_url = $2, text_content = $3 WHERE id = $4 RETURNING *",
        [title, video_url, clean_text_content, lessonId]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Aula não encontrada." });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao editar aula:", err);
      res.status(500).json({ error: "Erro ao editar aula." });
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

  router.put(
    "/modules/:moduleId/lessons/order",
    checkAdmin,
    async (req, res) => {
      const { orderedLessonIds } = req.body;
      try {
        const client = await pool.connect();
        await client.query("BEGIN");
        for (let i = 0; i < orderedLessonIds.length; i++) {
          const lessonId = orderedLessonIds[i];
          const newOrder = i + 1;
          await client.query(
            "UPDATE lessons SET lesson_order = $1 WHERE id = $2",
            [newOrder, lessonId]
          );
        }
        await client.query("COMMIT");
        client.release();
        res.status(200).json({ message: "Ordem das aulas atualizada." });
      } catch (err) {
        console.error("Erro ao reordenar aulas:", err);
        res.status(500).json({ error: "Erro ao reordenar aulas." });
      }
    }
  );

  return router;
};
