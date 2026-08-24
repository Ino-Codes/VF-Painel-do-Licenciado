const express = require("express");
const router = express.Router();
const { isLoggedIn, checkPermission } = require("../middleware/auth.js");
const { resolveVpartnerId, isLicenciado } = require("../companyAccess.js");

const COMPANIES_MAP = {
  "v-tax": 1,
  "v-banking": 2,
  "v-business": 3,
  "v-corp": 4,
  "v-tech": 5,
};

module.exports = function (pool, cloudinary, upload, logActivity) {
  // "all" → null (sem filtro por empresa); slug inválido/ausente → 1
  const getCompanyId = (slug) =>
    slug === "all" ? null : COMPANIES_MAP[slug] || 1;

  // ── 1. CREATE ────────────────────────────────────────────────
  router.post(
    "/",
    isLoggedIn,
    checkPermission("social.manage"),
    upload.array("files", 5),
    async (req, res) => {
      const { title, category, caption, company } = req.body;

      try {
        const companyId = getCompanyId(company);

        const uploadPromises = req.files.map(
          (file) =>
            new Promise((resolve, reject) => {
              cloudinary.uploader
                .upload_stream(
                  { folder: `social/${category}` },
                  (error, result) => {
                    if (error) reject(error);
                    resolve(result.secure_url);
                  },
                )
                .end(file.buffer);
            }),
        );

        const imageUrls = await Promise.all(uploadPromises);

        const result = await pool.query(
          `INSERT INTO social_posts
            (title, category, caption, images, created_by, company_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [title, category, caption, imageUrls, req.user.id, companyId],
        );

        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar post social:", err);
        res.status(500).json({ error: "Erro ao criar post" });
      }
    },
  );

  // ── 2. READ ──────────────────────────────────────────────────
  router.get("/", isLoggedIn, checkPermission("social.view"), async (req, res) => {
    const { company } = req.query;

    try {
      let companyId = getCompanyId(company);
      if (isLicenciado(req)) companyId = await resolveVpartnerId(pool);

      const params = [];
      const whereClauses = [];
      if (companyId !== null) {
        params.push(companyId);
        whereClauses.push(`company_id = $${params.length}`);
      }

      const whereString = whereClauses.length
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";
      const query = `
        SELECT * FROM social_posts
        ${whereString}
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query, params);

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

  // ── 3. UPDATE ────────────────────────────────────────────────
  router.put(
    "/:id",
    isLoggedIn,
    checkPermission("social.manage"),
    async (req, res) => {
      const { id } = req.params;
      const { title, category, caption, company } = req.body;

      try {
        const companyId = getCompanyId(company);

        const result = await pool.query(
          `UPDATE social_posts
           SET title = $1, category = $2, caption = $3, company_id = $4
           WHERE id = $5
           RETURNING *`,
          [title, category, caption, companyId, id],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Post não encontrado." });
        }

        // Mesmo padrão do files.js — try/catch isolado, sem await
        try {
          logActivity(
            req.user.id,
            req.user.email,
            "UPDATE_SOCIAL_POST",
            `Usuário ${req.user.email} editou o post social "${title}" (ID: ${id}).`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log de edição:", e);
        }

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao editar post social:", err);
        res.status(500).json({ error: "Erro ao editar conteúdo." });
      }
    },
  );

  // ── 4. DOWNLOAD ──────────────────────────────────────────────
  router.get("/download/:id", isLoggedIn, checkPermission("social.view"), async (req, res) => {
    try {
      const postResult = await pool.query(
        "SELECT title, category, images, company_id FROM social_posts WHERE id = $1",
        [req.params.id],
      );

      if (postResult.rowCount === 0) {
        return res.status(404).send("Post não encontrado.");
      }

      const { images, title, company_id } = postResult.rows[0];

      // Licenciado só baixa conteúdo da V-PARTNER; interno baixa qualquer um.
      const allowed =
        !isLicenciado(req) || company_id === (await resolveVpartnerId(pool));

      if (!allowed) {
        return res
          .status(403)
          .json({ error: "Acesso negado a este conteúdo." });
      }

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

      // Mesmo padrão do files.js — try/catch isolado, sem await
      try {
        logActivity(
          req.user.id,
          req.user.email,
          "Download em Massa",
          `Usuário ${req.user.email} baixou ${images.length} imagens do post "${title}" em .zip`,
          req.ipAddress,
        );
      } catch (e) {
        console.warn("Falha ao registrar log de download:", e);
      }

      res.json({ downloadUrl: zipUrl, isZip: true });
    } catch (err) {
      console.error("Erro no download social:", err);
      res.status(500).send("Erro ao processar o download.");
    }
  });

  // ── 5. DELETE ────────────────────────────────────────────────
  router.delete(
    "/:id",
    isLoggedIn,
    checkPermission("social.manage"),
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

        // Mesmo padrão do files.js — try/catch isolado, sem await
        try {
          logActivity(
            req.user.id,
            req.user.email,
            "DELETE_SOCIAL_POST",
            `Usuário ${req.user.email} excluiu o post social "${title}".`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log de exclusão:", e);
        }

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
