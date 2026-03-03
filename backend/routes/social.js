const express = require("express");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

// Mapeamento Estático das Empresas
const COMPANIES_MAP = {
  "valor-fiscal": 1,
  "valor-banking": 2,
  "valor-business": 3,
  "valor-corporate": 4,
};

module.exports = function (pool, cloudinary, upload, logActivity) {
  // --- HELPER: Resolve ID da empresa pelo Slug localmente ---
  const getCompanyId = (slug) => {
    // Se não for um slug válido ou vier vazio, cai no padrão 1 (Valor Fiscal)
    return COMPANIES_MAP[slug] || 1;
  };

  // 1. CREATE: Criar postagem usando company_id
  router.post(
    "/",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    upload.array("files", 5),
    async (req, res) => {
      const { title, category, caption, company } = req.body;

      try {
        const companyId = getCompanyId(company);

        const uploadPromises = req.files.map((file) => {
          return new Promise((resolve, reject) => {
            cloudinary.uploader
              .upload_stream(
                { folder: `social/${category}` },
                (error, result) => {
                  if (error) reject(error);
                  resolve(result.secure_url);
                },
              )
              .end(file.buffer);
          });
        });

        const imageUrls = await Promise.all(uploadPromises);

        const result = await pool.query(
          "INSERT INTO social_posts (title, category, caption, images, created_by, company_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          [title, category, caption, imageUrls, req.user.id, companyId],
        );

        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar post social:", err);
        res.status(500).json({ error: "Erro ao criar post" });
      }
    },
  );

  // 2. READ: Listar posts filtrando pelo company_id
  router.get("/", isLoggedIn, async (req, res) => {
    const { company } = req.query;

    try {
      const companyId = getCompanyId(company);

      const query = `
        SELECT * FROM social_posts 
        WHERE company_id = $1 
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query, [companyId]);

      const grouped = result.rows.reduce((acc, post) => {
        const cat = post.category || "Geral";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(post);
        return acc;
      }, {});

      res.json(grouped);
    } catch (err) {
      console.error("Erro ao buscar posts:", err);
      res.status(500).json({ error: "Erro ao buscar posts" });
    }
  });

  // 3. UPDATE: Editar postagem
  router.put(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { title, category, caption, company } = req.body;

      try {
        const companyId = getCompanyId(company);

        const result = await pool.query(
          "UPDATE social_posts SET title = $1, category = $2, caption = $3, company_id = $4 WHERE id = $5 RETURNING *",
          [title, category, caption, companyId, id],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Post não encontrado." });
        }

        await logActivity(
          req.user.id,
          req.user.email,
          "UPDATE_SOCIAL_POST",
          `Usuário ${req.user.email} editou o post social "${title}" (ID: ${id}).`,
          req.ipAddress,
        );

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao editar post social:", err);
        res.status(500).json({ error: "Erro ao editar conteúdo." });
      }
    },
  );

  // Rota de Download
  router.get("/download/:id", isLoggedIn, async (req, res) => {
    try {
      const postResult = await pool.query(
        "SELECT title, category, images FROM social_posts WHERE id = $1",
        [req.params.id],
      );

      if (postResult.rowCount === 0) {
        return res.status(404).send("Post não encontrado.");
      }

      const post = postResult.rows[0];
      const { images, title } = post;

      if (!images || images.length === 0) {
        return res.status(404).send("Nenhuma imagem encontrada.");
      }

      const sanitizedFilename = title.replace(/[^a-zA-Z0-9._-]/g, "_");

      if (images.length === 1) {
        const urlParts = images[0].split("/");
        const fileName = urlParts.pop().split(".")[0];
        const folderIndex = urlParts.indexOf("social");
        const folderPath = urlParts.slice(folderIndex).join("/");
        const publicId = `${folderPath}/${fileName}`;

        const signedUrl = cloudinary.url(publicId, {
          resource_type: "image",
          flags: `attachment:${sanitizedFilename}`,
          sign_url: true,
          secure: true,
          expires_at: Math.floor(Date.now() / 1000) + 600,
        });

        return res.json({ downloadUrl: signedUrl, isZip: false });
      }

      const publicIds = images.map((url) => {
        const parts = url.split("/");
        const name = parts.pop().split(".")[0];
        const folderIdx = parts.indexOf("social");
        return `${parts.slice(folderIdx).join("/")}/${name}`;
      });

      const zipUrl = cloudinary.utils.download_zip_url({
        public_ids: publicIds,
        resource_type: "image",
        allow_missing: true,
        target_public_id: sanitizedFilename,
      });

      try {
        await logActivity(
          req.user.id,
          req.user.email,
          "Download em Massa",
          `Usuário ${req.user.email} baixou ${images.length} imagens do post "${title}" em .zip`,
          req.ipAddress,
        );
      } catch (e) {
        console.warn("Falha ao registrar log:", e);
      }

      res.json({ downloadUrl: zipUrl, isZip: true });
    } catch (err) {
      console.error("Erro no download social:", err);
      res.status(500).send("Erro ao processar o download.");
    }
  });

  // 4. DELETE: Excluir post
  router.delete(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;

      try {
        const postResult = await pool.query(
          "SELECT title, images FROM social_posts WHERE id = $1",
          [id],
        );

        if (postResult.rowCount === 0) {
          return res.status(404).json({ error: "Post não encontrado." });
        }

        const { title, images } = postResult.rows[0];

        if (images && images.length > 0) {
          const deletePromises = images.map((url) => {
            const parts = url.split("/");
            const fileName = parts.pop();
            const folder = parts.slice(parts.indexOf("social")).join("/");
            const publicId = `${folder}/${fileName.split(".")[0]}`;

            return cloudinary.uploader.destroy(publicId);
          });
          await Promise.all(deletePromises);
        }

        await pool.query("DELETE FROM social_posts WHERE id = $1", [id]);

        await logActivity(
          req.user.id,
          req.user.email,
          "DELETE_SOCIAL_POST",
          `Usuário ${req.user.email} excluiu o post social "${title}".`,
          req.ipAddress,
        );

        res.json({
          success: true,
          message: "Post e imagens excluídos com sucesso.",
        });
      } catch (err) {
        console.error("Erro ao excluir post social:", err);
        res.status(500).json({ error: "Erro ao tentar excluir o conteúdo." });
      }
    },
  );

  return router;
};
