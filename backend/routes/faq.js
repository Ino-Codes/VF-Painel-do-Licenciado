const express = require("express");
const router = express.Router();
const path = require("path");
const { isLoggedIn, checkPermission } = require("../middleware/auth.js");
const { resolveVpartnerId, isLicenciado } = require("../companyAccess.js");

module.exports = function (pool, cloudinary, upload) {
  const getCompanyId = async (slug) => {
    if (!slug || slug === "undefined" || slug === "null") return null;
    try {
      const result = await pool.query(
        "SELECT id FROM companies WHERE slug = $1",
        [slug]
      );
      if (result.rows.length > 0) return result.rows[0].id;
      console.warn(`[FAQ] Slug de empresa não encontrado no banco: "${slug}"`);
      return null;
    } catch (error) {
      console.error("Erro ao resolver company_id:", error);
      return null;
    }
  };

  router.get("/", isLoggedIn, checkPermission("faq.view"), async (req, res) => {
    const { category, search, page = 1, limit = 15, company } = req.query;

    try {
      const offset = (page - 1) * limit;
      const isAll = company === "all";
      let companyId = isAll ? null : await getCompanyId(company);
      // Licenciado é forçado à V-PARTNER (ignora o param/all).
      if (isLicenciado(req)) companyId = await resolveVpartnerId(pool);

      if (!isAll && companyId === null && !isLicenciado(req)) {
        return res.status(404).json({ error: "Empresa não encontrada.", faqs: [], totalCount: 0, totalPages: 0 });
      }

      const whereClauses = [];
      const params = [];
      if (companyId !== null) {
        params.push(companyId);
        whereClauses.push(`company_id = $${params.length}`);
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

  router.get("/categories", isLoggedIn, checkPermission("faq.view"), async (req, res) => {
    const { company } = req.query;

    try {
      const isAll = company === "all";
      let companyId = isAll ? null : await getCompanyId(company);
      if (isLicenciado(req)) companyId = await resolveVpartnerId(pool);

      if (!isAll && companyId === null && !isLicenciado(req)) {
        return res.json([]);
      }

      const params = [];
      const whereClauses = [];
      if (companyId !== null) {
        params.push(companyId);
        whereClauses.push(`company_id = $${params.length}`);
      }

      const whereString = whereClauses.length
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";

      const query = `SELECT DISTINCT category FROM faq ${whereString} ORDER BY category ASC`;

      const result = await pool.query(query, params);
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
    checkPermission("faq.manage"),
    upload.single("document"),
    async (req, res) => {
      const { category, question, answer, company } = req.body;

      try {
        const companyId = await getCompanyId(company);
        let document_url = null;
        let document_originalname = null;

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
          "INSERT INTO faq (category, question, answer, document_url, document_originalname, company_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          [
            category,
            question,
            answer,
            document_url,
            document_originalname,
            companyId,
          ]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar FAQ:", err);
        res.status(500).json({ error: "Erro ao criar FAQ." });
      }
    }
  );

  router.delete(
    "/admin/:id",
    isLoggedIn,
    checkPermission("faq.manage"),
    async (req, res) => {
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
    }
  );

  return router;
};
