const express = require("express");
const router = express.Router();
const path = require("path");
const { isLoggedIn, isAdmin, checkRole } = require("../middleware/auth.js");

module.exports = function (pool, cloudinary, upload) {
  router.get("/", isLoggedIn, async (req, res) => {
    const { category, search, page = 1, limit = 15 } = req.query;
    const userRole = req.user ? req.user.role : null; // Pega a role do usuário logado

    try {
      const offset = (page - 1) * limit;
      let whereClauses = [];
      const params = [];

      if (userRole === "licenciado") {
        whereClauses.push(
          "(visibility = 'todos' OR visibility = 'licenciados')"
        );
      } else if (userRole === "admin" || userRole === "colaborador") {
        whereClauses.push("(visibility = 'todos' OR visibility = 'internos')");
      } else {
        // Para usuários não logados ou sem role definida, mostrar apenas 'todos'
        whereClauses.push("visibility = 'todos'");
      }

      if (category) {
        params.push(category);
        whereClauses.push(`category = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        whereClauses.push(
          `(question ILIKE $${params.length} OR answer ILIKE $${params.length})`
        );
      }

      const whereString =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const countSql = `SELECT COUNT(*) FROM faq ${whereString}`;
      const faqSql = `SELECT * FROM faq ${whereString} ORDER BY category, question ASC LIMIT $${
        params.length + 1
      } OFFSET $${params.length + 2}`;

      const [countResult, faqResult] = await Promise.all([
        pool.query(countSql, params),
        pool.query(faqSql, [...params, limit, offset]),
      ]);

      const totalCount = parseInt(countResult.rows[0].count, 10);
      res.json({
        faqs: faqResult.rows,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      });
    } catch (err) {
      console.error("Erro ao buscar FAQs:", err);
      res.status(500).json({ error: "Erro ao buscar FAQs" });
    }
  });

  router.get("/categories", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT DISTINCT category FROM faq ORDER BY category ASC"
      );
      res.json(result.rows.map((row) => row.category));
    } catch (err) {
      console.error("Erro ao buscar categorias do FAQ:", err);
      res.status(500).json({ error: "Erro ao buscar categorias." });
    }
  });

  router.get("/download/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const fileResult = await pool.query(
        "SELECT document_url, document_originalname FROM faq WHERE id = $1",
        [id]
      );

      if (fileResult.rowCount === 0 || !fileResult.rows[0].document_url) {
        return res.status(404).send("Anexo não encontrado.");
      }

      const { document_url: fileUrl, document_originalname: originalname } =
        fileResult.rows[0];

      const resourceType = fileUrl.includes("/image/") ? "image" : "raw";
      const publicIdMatch = fileUrl.match(/\/v\d+\/(.+)\.[^/.]+$/);
      const publicId = publicIdMatch
        ? decodeURIComponent(publicIdMatch[1])
        : null;

      if (!publicId) {
        return res
          .status(500)
          .send("Não foi possível analisar a URL do anexo.");
      }

      const fileExtension = path.extname(fileUrl).toLowerCase();

      const options = {
        resource_type: resourceType,
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + 300,
      };

      if (fileExtension === ".pdf") {
        options.flags = ["inline"];
      } else {
        options.attachment = originalname;
      }

      const signedUrl = cloudinary.url(publicId, options);
      res.redirect(signedUrl);
    } catch (err) {
      console.error("Erro ao gerar link de download do anexo:", err);
      res.status(500).send("Erro interno ao processar o download.");
    }
  });

  router.post(
    "/admin",
    isLoggedIn,
    isAdmin,
    upload.single("document"),
    async (req, res) => {
      const { category, question, answer, visibility = "todos" } = req.body;
      let document_url = null;
      let document_originalname = null;

      try {
        if (req.file) {
          const resourceType = req.file.mimetype.startsWith("image")
            ? "image"
            : "raw";
          const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader
              .upload_stream(
                { resource_type: resourceType },
                (error, result) => {
                  if (error) reject(error);
                  resolve(result);
                }
              )
              .end(req.file.buffer);
          });
          document_url = uploadResult.secure_url;
          document_originalname = req.file.originalname;
        }

        const result = await pool.query(
          "INSERT INTO faq (category, question, answer, document_url, document_originalname, visibility) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          [
            category,
            question,
            answer,
            document_url,
            document_originalname,
            visibility,
          ]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar FAQ:", err);
        res.status(500).json({ error: "Erro ao criar FAQ." });
      }
    }
  );

  router.delete("/admin/:id", isLoggedIn, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const faqResult = await pool.query(
        "SELECT document_url FROM faq WHERE id = $1",
        [id]
      );
      if (faqResult.rowCount === 0) {
        return res.status(404).json({ error: "FAQ não encontrado." });
      }

      const docUrl = faqResult.rows[0].document_url;
      if (docUrl) {
        const resourceType = docUrl.includes("/image/") ? "image" : "raw";
        const publicIdMatch = docUrl.match(/\/v\d+\/(.+)\.[^/.]+$/);
        const publicId = publicIdMatch ? publicIdMatch[1] : null;

        if (publicId) {
          await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
          });
        }
      }

      await pool.query("DELETE FROM faq WHERE id = $1", [id]);
      res.json({ success: true, message: "FAQ excluído com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir FAQ:", err);
      res.status(500).json({ error: "Erro ao excluir FAQ." });
    }
  });

  return router;
};
