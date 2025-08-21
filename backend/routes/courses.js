const express = require("express");
const router = express.Router();
const { isAdmin, isLoggedIn } = require("../middleware/auth.js");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fetch = require("node-fetch");

const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const uploadIndex = url.indexOf("/upload/");
  if (uploadIndex === -1) return null;

  const urlPart = url.substring(uploadIndex + "/upload/".length);
  // Remove a versão (ex: v12345/) se ela existir
  const publicIdWithFolder = urlPart.includes("/v")
    ? urlPart.substring(urlPart.indexOf("/") + 1)
    : urlPart;
  const publicId = publicIdWithFolder.substring(
    0,
    publicIdWithFolder.lastIndexOf(".")
  );

  return publicId;
};

module.exports = function (pool, cloudinary, upload) {
  const checkAdmin = isAdmin(pool);
  const checkLoggedIn = isLoggedIn(pool);

  // --- ROTAS PÚBLICAS ---
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
      const courseResult = await pool.query(
        "SELECT * FROM courses WHERE id = $1 AND is_active = TRUE",
        [courseId]
      );
      if (courseResult.rowCount === 0) {
        return res
          .status(404)
          .json({ error: "Curso não encontrado ou inativo." });
      }
      const course = courseResult.rows[0];

      const modulesResult = await pool.query(
        "SELECT * FROM modules WHERE course_id = $1 ORDER BY module_order ASC",
        [courseId]
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

      const progressResult = await pool.query(
        "SELECT lesson_id FROM progress WHERE user_id = $1",
        [userId]
      );
      const completedLessons = progressResult.rows.map((row) => row.lesson_id);
      course.completedLessons = completedLessons;

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

  router.get("/:courseId/certificate", checkLoggedIn, async (req, res) => {
    const { courseId } = req.params;
    const { id: userId, nome: userName } = req.user;

    try {
      const progressQuery = `SELECT COUNT(l.id)::int AS total, COUNT(p.id)::int AS completed FROM courses c JOIN modules m ON m.course_id = c.id JOIN lessons l ON l.module_id = m.id LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = $1 WHERE c.id = $2 GROUP BY c.id`;
      const progressResult = await pool.query(progressQuery, [
        userId,
        courseId,
      ]);

      if (
        progressResult.rowCount === 0 ||
        progressResult.rows[0].completed < progressResult.rows[0].total
      ) {
        return res.status(403).send("Curso ainda não concluído.");
      }

      const courseResult = await pool.query(
        "SELECT title, certificate_template_url FROM courses WHERE id = $1",
        [courseId]
      );
      const course = courseResult.rows[0];

      if (!course.certificate_template_url) {
        return res
          .status(404)
          .send("Modelo de certificado não encontrado para este curso.");
      }

      const templateBytes = await fetch(course.certificate_template_url).then(
        (res) => res.arrayBuffer()
      );
      const pdfDoc = await PDFDocument.create();
      const templateImage = await pdfDoc.embedPng(templateBytes);

      const page = pdfDoc.addPage([templateImage.width, templateImage.height]);
      page.drawImage(templateImage, {
        x: 0,
        y: 0,
        width: templateImage.width,
        height: templateImage.height,
      });

      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      page.drawText(userName, {
        x: page.getWidth() / 2 - font.widthOfTextAtSize(userName, 30) / 2,
        y: page.getHeight() / 2,
        font,
        size: 30,
        color: rgb(0.1, 0.1, 0.1),
      });

      const pdfBytes = await pdfDoc.save();

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
    try {
      const result = await pool.query(
        "INSERT INTO lessons (module_id, title, video_url, text_content, lesson_order) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [moduleId, title, video_url, text_content, lesson_order]
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
    try {
      const result = await pool.query(
        "UPDATE lessons SET title = $1, video_url = $2, text_content = $3 WHERE id = $4 RETURNING *",
        [title, video_url, text_content, lessonId]
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

  // ROTA PARA UPLOAD DA THUMBNAIL
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
        const oldCourseResult = await pool.query(
          "SELECT thumbnail_url FROM courses WHERE id = $1",
          [courseId]
        );
        const oldThumbnailUrl = oldCourseResult.rows[0]?.thumbnail_url;

        if (oldThumbnailUrl) {
          const publicId = getPublicIdFromUrl(oldThumbnailUrl);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId, {
              resource_type: "image",
            });
          }
        }

        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ resource_type: "image" }, (error, result) => {
              if (error) reject(error);
              resolve(result);
            })
            .end(req.file.buffer);
        });

        const newThumbnailUrl = uploadResult.secure_url;
        const result = await pool.query(
          "UPDATE courses SET thumbnail_url = $1 WHERE id = $2 RETURNING *",
          [newThumbnailUrl, courseId]
        );
        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro no upload da thumbnail:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      }
    }
  );

  // ROTA DE UPLOAD DO MODELO DE CERTIFICADO (LÓGICA DE EXCLUSÃO ATUALIZADA)
  router.post(
    "/:courseId/certificate-template",
    checkAdmin,
    upload.single("template"),
    async (req, res) => {
      const { courseId } = req.params;
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "Nenhum arquivo de modelo enviado." });
      }
      try {
        const oldCourseResult = await pool.query(
          "SELECT certificate_template_url FROM courses WHERE id = $1",
          [courseId]
        );
        const oldTemplateUrl =
          oldCourseResult.rows[0]?.certificate_template_url;

        if (oldTemplateUrl) {
          const publicId = getPublicIdFromUrl(oldTemplateUrl);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId, {
              resource_type: "image",
            });
          }
        }

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
        res.status(500).json({ error: "Erro no servidor." });
      }
    }
  );

  return router;
};
