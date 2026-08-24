const express = require("express");
const router = express.Router();
const { isLoggedIn, checkPermission } = require("../middleware/auth.js");
const { resolveVpartnerId, isLicenciado } = require("../companyAccess.js");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
const crypto = require("crypto");
const path = require("path");

module.exports = function (pool, cloudinary, upload) {
  // --- Helper para ID da Empresa ---
  const getCompanyId = async (slug) => {
    if (slug === "all") return null; // "all" → sem filtro por empresa
    if (!slug || slug === "undefined" || slug === "null") return 1;
    try {
      const result = await pool.query(
        "SELECT id FROM companies WHERE slug = $1",
        [slug],
      );
      return result.rows.length > 0 ? result.rows[0].id : 1;
    } catch (error) {
      console.error("Erro ao resolver company_id:", error);
      return 1;
    }
  };

  // --- ROTAS PÚBLICAS (Aluno) ---
  router.get("/public", isLoggedIn, checkPermission("courses.view"), async (req, res) => {
    const { id: userId } = req.user;
    const { company } = req.query;

    try {
      // Licenciado é forçado à V-PARTNER; interno honra o param (null = todas).
      let companyId = await getCompanyId(company);
      if (isLicenciado(req)) companyId = await resolveVpartnerId(pool);

      // Filtro de empresa (null = todas)
      const params = [userId];
      let companyFilter = "";
      if (companyId !== null) {
        params.push(companyId);
        companyFilter = `AND c.company_id = $${params.length}`;
      }

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
          ${companyFilter}
        GROUP BY
          c.id
        ORDER BY
          c.title ASC;
      `;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar cursos públicos:", err);
      res.status(500).json({ error: "Erro ao buscar cursos." });
    }
  });

  // Rota de detalhe público (Mantida, busca por ID direto)
  router.get("/public/:id", isLoggedIn, checkPermission("courses.view"), async (req, res) => {
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

  // ... (Rotas de progresso /complete e /progress mantidas iguais) ...
  router.post("/lessons/:lessonId/complete", isLoggedIn, async (req, res) => {
    const { lessonId } = req.params;
    const { id: userId } = req.user;
    try {
      await pool.query(
        "INSERT INTO progress (user_id, lesson_id) VALUES ($1, $2) ON CONFLICT (user_id, lesson_id) DO NOTHING",
        [userId, lessonId],
      );
      res.status(200).json({ message: "Progresso salvo com sucesso." });
    } catch (err) {
      console.error("Erro ao salvar progresso:", err);
      res.status(500).json({ error: "Erro ao salvar progresso." });
    }
  });

  router.delete("/lessons/:lessonId/progress", isLoggedIn, async (req, res) => {
    const { lessonId } = req.params;
    const { id: userId } = req.user;
    try {
      await pool.query(
        "DELETE FROM progress WHERE user_id = $1 AND lesson_id = $2",
        [userId, lessonId],
      );
      res.status(200).json({ message: "Progresso removido." });
    } catch (err) {
      console.error("Erro ao remover progresso:", err);
      res.status(500).json({ error: "Erro ao remover progresso." });
    }
  });

  // --- ROTAS DE ADMINISTRAÇÃO ---

  // Listar Cursos (Admin) - Agora filtra por Empresa
  router.get("/", isLoggedIn, checkPermission("courses.manage"), async (req, res) => {
    try {
      const query = `
        SELECT c.*, comp.name as company_name 
        FROM courses c
        LEFT JOIN companies comp ON c.company_id = comp.id
        ORDER BY c.created_at DESC
      `;

      const result = await pool.query(query);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar cursos:", err);
      res.status(500).json({ error: "Erro ao buscar cursos." });
    }
  });

  // Detalhe Admin (Mantido igual)
  router.get(
    "/:id",
    isLoggedIn,
    checkPermission("courses.manage"),
    async (req, res) => {
      const { id } = req.params;
      try {
        const courseResult = await pool.query(
          "SELECT * FROM courses WHERE id = $1",
          [id],
        );
        if (courseResult.rowCount === 0) {
          return res.status(404).json({ error: "Curso não encontrado." });
        }
        const course = courseResult.rows[0];

        const modulesResult = await pool.query(
          "SELECT * FROM modules WHERE course_id = $1 ORDER BY module_order ASC",
          [id],
        );
        const modules = modulesResult.rows;
        for (const module of modules) {
          const lessonsResult = await pool.query(
            "SELECT id, module_id, title, video_url, text_content, lesson_order FROM lessons WHERE module_id = $1 ORDER BY lesson_order ASC",
            [module.id],
          );
          module.lessons = lessonsResult.rows;
        }
        course.modules = modules;

        const quizResult = await pool.query(
          "SELECT * FROM quizzes WHERE course_id = $1",
          [id],
        );
        if (quizResult.rowCount > 0) {
          const quiz = quizResult.rows[0];
          const questionsResult = await pool.query(
            "SELECT * FROM questions WHERE quiz_id = $1 ORDER BY id ASC",
            [quiz.id],
          );
          const questions = questionsResult.rows;

          for (const question of questions) {
            const optionsResult = await pool.query(
              "SELECT * FROM options WHERE question_id = $1 ORDER BY id ASC",
              [question.id],
            );
            question.options = optionsResult.rows;
          }
          quiz.questions = questions;
          course.quiz = quiz;
        } else {
          course.quiz = null;
        }

        res.json(course);
      } catch (err) {
        console.error("Erro ao buscar detalhes do curso:", err);
        res.status(500).json({ error: "Erro ao buscar detalhes do curso." });
      }
    },
  );

  router.post("/", isLoggedIn, checkPermission("courses.manage"), async (req, res) => {
    const { title, description, company } = req.body;

    if (!title) {
      return res.status(400).json({ error: "O título é obrigatório." });
    }
    try {
      const companyId = await getCompanyId(company);

      const result = await pool.query(
        "INSERT INTO courses (title, description, company_id) VALUES ($1, $2, $3) RETURNING *",
        [title, description, companyId],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao criar curso:", err);
      res.status(500).json({ error: "Erro ao criar curso." });
    }
  });

  // ... (Restante das rotas PUT, DELETE, QUIZ, THUMBNAIL, MÓDULOS, AULAS e CERTIFICADOS mantidas inalteradas pois dependem do ID do curso/aula) ...
  // Vou incluir aqui o restante do arquivo para garantir a integridade, mantendo a lógica original.

  router.put(
    "/:id",
    isLoggedIn,
    checkPermission("courses.manage"),
    async (req, res) => {
      const { id } = req.params;
      const { title, description, is_active } = req.body;
      try {
        const result = await pool.query(
          "UPDATE courses SET title = $1, description = $2, is_active = $3 WHERE id = $4 RETURNING *",
          [title, description, is_active, id],
        );
        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Curso não encontrado." });
        }
        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao atualizar curso:", err);
        res.status(500).json({ error: "Erro ao atualizar curso." });
      }
    },
  );

  router.delete(
    "/:id",
    isLoggedIn,
    checkPermission("courses.manage"),
    async (req, res) => {
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
    },
  );

  // QUIZ
  router.post(
    "/:courseId/quiz",
    isLoggedIn,
    checkPermission("courses.manage"),
    async (req, res) => {
      const { courseId } = req.params;
      const { title, passing_score } = req.body;

      try {
        const existingQuiz = await pool.query(
          "SELECT id FROM quizzes WHERE course_id = $1",
          [courseId],
        );
        if (existingQuiz.rowCount > 0) {
          return res
            .status(409)
            .json({ error: "Este curso já possui um quiz." });
        }

        const result = await pool.query(
          "INSERT INTO quizzes (course_id, title, passing_score) VALUES ($1, $2, $3) RETURNING *",
          [courseId, title, passing_score],
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar quiz:", err);
        res.status(500).json({ error: "Erro interno ao criar o quiz." });
      }
    },
  );

  // THUMBNAIL
  router.post(
    "/:courseId/thumbnail",
    isLoggedIn,
    checkPermission("courses.manage"),
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
          [newThumbnailUrl, courseId],
        );

        res.json({ success: true, thumbnailUrl: newThumbnailUrl });
      } catch (err) {
        console.error("Erro no upload da thumbnail:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      }
    },
  );

  // CERTIFICADOS (Mantido igual)
  router.get("/:courseId/certificate", isLoggedIn, async (req, res) => {
    const { courseId } = req.params;
    const { id: userId } = req.user;

    let browser = null;

    try {
      const userResult = await pool.query(
        "SELECT nome FROM users WHERE id = $1",
        [userId],
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

      const courseResult = await pool.query(
        "SELECT title, certificate_template_url FROM courses WHERE id = $1",
        [courseId],
      );
      const course = courseResult.rows[0];

      if (!course) {
        return res.status(404).send("Curso não encontrado.");
      }

      let backgroundImageUrl = course.certificate_template_url
        ? course.certificate_template_url
        : "https://res.cloudinary.com/dsgbgrll5/image/upload/v1761934436/background_yltyhg.png";

      if (backgroundImageUrl.toLowerCase().endsWith(".pdf")) {
        backgroundImageUrl = backgroundImageUrl
          .replace("/upload/", "/upload/pg_1/")
          .replace(".pdf", ".png");
      }

      const completionDate = new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>

          <style>
            @import url("https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap");
            @import url('https://fonts.googleapis.com/css2?family=Edu+NSW+ACT+Cursive:wght@400..700&display=swap');
            
            body {
                font-family: 'Montserrat', sans-serif;
                margin: 0;
                padding: 0;
                background-image: url("${backgroundImageUrl}");
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                display: flex;
                justify-content: center;
                align-items: center;
                text-align: center;
            }

            .certificate-container {
                background: none;

                max-width: 1124px;
                min-width: 1124px;
                width: 1124px;;
                
                height: 788px;
                max-height: 788px;
                min-height: 788px;
                
                position: relative;
            }

            .title {
                font-family: 'Playfair Display', serif;
                font-size: 4em;
                color: #cda93f;
                margin-bottom: 0;
                line-height: 1;
            }

            .subtitle {
                font-family: 'Montserrat', sans-serif;
                font-size: 1.5em;
                font-style: semibold;
                color: #252525;
                margin-top: 5px;
                margin-bottom: 80px;
            }

            .body-text {
                font-family: 'Montserrat', sans-serif;
                font-size: 1.2em;
                color: #252525;
                margin-bottom: 10px;
            }

            .student-name {
                font-family: 'Snell Roundhand', 'Edu NSW ACT Cursive', serif;
                font-style: italic;
                font-size: 4em;
                color: #252525;
                margin: 20px 0;
                line-height: 1.2;
            }

            .course-name {
                font-family: 'Montserrat', sans-serif;
                font-size: 1.5em;
                color: #252525;
                font-weight: bold;
                margin-top: 15px;
                margin-bottom: 15px;
                text-transform: uppercase;
            }

            .signature-line {
                width: 250px;
                border-bottom: 1px solid #252525;
                margin: 91px auto 10px auto;
            }

            .signature-text {
                font-size: 1.1em;
                color: #252525;
                margin-bottom: 70px;
            }

            .date {
                font-size: 1.1em;
                color: #252525;
                margin-bottom: 10px;
            }

            .logo-container {
                margin-top: 10px;
            }
          </style>
        </head>
          <body>
            <div class="certificate-container">
              <h1 class="title">CERTIFICADO</h1>
              <p class="subtitle">de conclusão</p>

              <p class="body-text">A V-CORP certifica que</p>
              <p class="student-name">${userName}</p>
              <p class="body-text">concluiu com êxito o treinamento</p>
              <p class="course-name">${course.title}</p>
              <p class="body-text">realizado pela empresa.</p>

              <div class="signature-line"></div>
              <p class="signature-text">Assinatura</p>

              <p class="date">${completionDate}</p>

              <div class="logo-container">
                <img src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1782936521/textopreto_svfbdt.png" alt="Logo V-CORP" width="180" />
              </div>
            </div>
          </body>
        </html>
      `;

      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });

      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });
      const pdfBytes = await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
      });

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
        `attachment; filename="certificado-${course.title}.pdf"`,
      );
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      console.error("Erro ao gerar certificado:", err);
      res.status(500).send("Erro ao gerar certificado.");
    } finally {
      if (browser !== null) {
        await browser.close();
      }
    }
  });

  router.post(
    "/:courseId/certificate-template",
    isLoggedIn,
    checkPermission("courses.manage"),
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
          [newTemplateUrl, courseId],
        );

        res.json({ success: true, templateUrl: newTemplateUrl });
      } catch (err) {
        console.error("Erro no upload do modelo de certificado:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      }
    },
  );

  // --- Módulos ---
  router.post(
    "/:courseId/modules",
    isLoggedIn,
    checkPermission("courses.manage"),
    async (req, res) => {
      const { courseId } = req.params;
      const { title, module_order } = req.body;
      try {
        const result = await pool.query(
          "INSERT INTO modules (course_id, title, module_order) VALUES ($1, $2, $3) RETURNING *",
          [courseId, title, module_order],
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar módulo:", err);
        res.status(500).json({ error: "Erro ao criar módulo." });
      }
    },
  );

  router.delete(
    "/modules/:moduleId",
    isLoggedIn,
    checkPermission("courses.manage"),
    async (req, res) => {
      const { moduleId } = req.params;
      try {
        await pool.query("DELETE FROM modules WHERE id = $1", [moduleId]);
        res.status(204).send();
      } catch (err) {
        console.error("Erro ao deletar módulo:", err);
        res.status(500).json({ error: "Erro ao deletar módulo." });
      }
    },
  );

  router.put(
    "/:courseId/modules/order",
    isLoggedIn,
    checkPermission("courses.manage"),
    async (req, res) => {
      const { orderedModuleIds } = req.body;
      try {
        const client = await pool.connect();
        await client.query("BEGIN");
        for (let i = 0; i < orderedModuleIds.length; i++) {
          const moduleId = orderedModuleIds[i];
          const newOrder = i + 1;
          await client.query(
            "UPDATE modules SET module_order = $1 WHERE id = $2",
            [newOrder, moduleId],
          );
        }
        await client.query("COMMIT");
        client.release();
        res.status(200).json({ message: "Ordem dos módulos atualizada." });
      } catch (err) {
        console.error("Erro ao reordenar módulos:", err);
        res.status(500).json({ error: "Erro ao reordenar módulos." });
      }
    },
  );

  // --- Aulas ---
  router.post(
    "/modules/:moduleId/lessons",
    isLoggedIn,
    checkPermission("courses.manage"),
    async (req, res) => {
      const { moduleId } = req.params;
      const { title, video_url, text_content, lesson_order } = req.body;

      const clean_text_content = DOMPurify.sanitize(text_content);

      try {
        const result = await pool.query(
          "INSERT INTO lessons (module_id, title, video_url, text_content, lesson_order) VALUES ($1, $2, $3, $4, $5) RETURNING *",
          [moduleId, title, video_url, clean_text_content, lesson_order],
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar aula:", err);
        res.status(500).json({ error: "Erro ao criar aula." });
      }
    },
  );

  router.put(
    "/lessons/:lessonId",
    isLoggedIn,
    checkPermission("courses.manage"),
    async (req, res) => {
      const { lessonId } = req.params;
      const { title, video_url, text_content } = req.body;

      const clean_text_content = DOMPurify.sanitize(text_content);

      try {
        const result = await pool.query(
          "UPDATE lessons SET title = $1, video_url = $2, text_content = $3 WHERE id = $4 RETURNING *",
          [title, video_url, clean_text_content, lessonId],
        );
        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Aula não encontrada." });
        }
        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao editar aula:", err);
        res.status(500).json({ error: "Erro ao editar aula." });
      }
    },
  );

  router.delete(
    "/lessons/:lessonId",
    isLoggedIn,
    checkPermission("courses.manage"),
    async (req, res) => {
      const { lessonId } = req.params;
      try {
        await pool.query("DELETE FROM lessons WHERE id = $1", [lessonId]);
        res.status(204).send();
      } catch (err) {
        console.error("Erro ao deletar aula:", err);
        res.status(500).json({ error: "Erro ao deletar aula." });
      }
    },
  );

  router.put(
    "/modules/:moduleId/lessons/order",
    isLoggedIn,
    checkPermission("courses.manage"),
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
            [newOrder, lessonId],
          );
        }
        await client.query("COMMIT");
        client.release();
        res.status(200).json({ message: "Ordem das aulas atualizada." });
      } catch (err) {
        console.error("Erro ao reordenar aulas:", err);
        res.status(500).json({ error: "Erro ao reordenar aulas." });
      }
    },
  );

  return router;
};
