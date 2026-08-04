const express = require("express");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

module.exports = function (pool, cloudinary, upload, logActivity) {
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
    }
  };

  // --- LISTAR ARQUIVOS ---
  router.get("/", isLoggedIn, async (req, res) => {
    const { category, search, company } = req.query;
    const { role } = req.user;

    try {
      const companyId = await getCompanyId(company);

      const params = [];
      const whereClauses = [];
      if (companyId !== null) {
        params.push(companyId);
        whereClauses.push(`company_id = $${params.length}`);
      }

      if (role === "licenciado") {
        whereClauses.push(
          "(visibility = 'todos' OR visibility = 'licenciados')",
        );
      } else if (role !== "admin") {
        whereClauses.push(
          "(visibility = 'todos' OR visibility = 'colaboradores')",
        );
      }

      if (category) {
        params.push(category);
        whereClauses.push(`category = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        whereClauses.push(
          `(originalname ILIKE $${params.length} OR folder ILIKE $${params.length})`,
        );
      }

      const whereString = whereClauses.length
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";
      const sql = `SELECT * FROM archives ${whereString} ORDER BY folder ASC, originalname ASC`;

      const result = await pool.query(sql, params);

      const groupedByFolder = result.rows.reduce((acc, file) => {
        const folderName = file.folder || "Geral";
        if (!acc[folderName]) acc[folderName] = [];
        acc[folderName].push(file);
        return acc;
      }, {});

      res.json(groupedByFolder);
    } catch (err) {
      console.error("Erro ao buscar arquivos:", err);
      res.status(500).json({ error: "Erro ao buscar arquivos" });
    }
  });

  // --- LISTAR CATEGORIAS ---
  router.get("/categories", isLoggedIn, async (req, res) => {
    const { role } = req.user;
    const { company } = req.query;

    try {
      const companyId = await getCompanyId(company);

      const params = [];
      const whereClauses = [];
      if (companyId !== null) {
        params.push(companyId);
        whereClauses.push(`company_id = $${params.length}`);
      }

      if (role === "licenciado") {
        whereClauses.push(
          "(visibility = 'todos' OR visibility = 'licenciados')",
        );
      } else if (role !== "admin") {
        whereClauses.push(
          "(visibility = 'todos' OR visibility = 'colaboradores')",
        );
      }

      const whereString = whereClauses.length
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";
      const query = `SELECT DISTINCT category FROM archives ${whereString} ORDER BY category ASC`;

      const result = await pool.query(query, params);
      res.json(result.rows.map((row) => row.category));
    } catch (err) {
      console.error("Erro ao buscar categorias:", err);
      res.status(500).json({ error: "Erro ao buscar categorias." });
    }
  });

  // --- UPLOAD ---
  router.post(
    "/",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    upload.single("file"),
    async (req, res) => {
      const { originalname, category, folder, visibility, company } = req.body;

      if (!req.file)
        return res.status(400).json({ error: "Nenhum arquivo enviado." });

      try {
        const companyId = await getCompanyId(company);

        const isImage = req.file.mimetype.startsWith("image/");
        const resourceType = isImage ? "image" : "raw";

        const uploadResult = await new Promise((resolve, reject) => {
          const originalExt = req.file.originalname.includes(".")
            ? "." + req.file.originalname.split(".").pop()
            : "";

          const cleanName = originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
          const uniquePublicId = `${cleanName}_${Date.now()}${originalExt}`;

          cloudinary.uploader
            .upload_stream(
              {
                resource_type: resourceType,
                folder: category,
                tags: [category, folder],
                ...(resourceType === "raw" && { public_id: uniquePublicId }),
              },
              (error, result) => {
                if (error) reject(error);
                resolve(result);
              },
            )
            .end(req.file.buffer);
        });

        const { secure_url: fileUrl, public_id: publicId } = uploadResult;

        const result = await pool.query(
          `INSERT INTO archives
           (filename, originalname, category, folder, visibility, public_id, company_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [fileUrl, originalname, category, folder, visibility, publicId, companyId],
        );

        try {
          await logActivity(
            req.user?.id || null,
            req.user?.email || "desconhecido",
            "CREATE_ARCHIVE",
            `Usuário ${req.user?.email || "desconhecido"} enviou o arquivo "${originalname}" na empresa ID ${companyId}.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log de upload:", e);
        }

        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro no upload de arquivo:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      }
    },
  );

  // --- EDITAR ---
  router.put(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { originalname, category, folder, visibility } = req.body;

      try {
        const result = await pool.query(
          "UPDATE archives SET originalname = $1, category = $2, folder = $3, visibility = $4 WHERE id = $5 RETURNING *",
          [originalname, category, folder, visibility, id],
        );
        if (result.rowCount === 0)
          return res.status(404).json({ error: "Arquivo não encontrado." });

        try {
          await logActivity(
            req.user.id,
            req.user.email,
            "UPDATE_ARCHIVE",
            `Usuário ${req.user.email} atualizou o arquivo "${originalname}" (ID: ${id}).`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log de atualização:", e);
        }

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao editar arquivo:", err);
        res.status(500).json({ error: "Erro ao editar arquivo." });
      }
    },
  );

  // --- EXCLUIR ---
  router.delete(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      try {
        const fileResult = await pool.query(
          "SELECT public_id, filename, originalname FROM archives WHERE id = $1",
          [id],
        );
        if (fileResult.rowCount === 0)
          return res.status(404).json({ error: "Arquivo não encontrado." });

        const {
          public_id: publicId,
          filename: fileUrl,
          originalname,
        } = fileResult.rows[0];

        if (publicId) {
          const resourceType = fileUrl.includes("/image/") ? "image" : "raw";
          await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
          });
        }

        await pool.query("DELETE FROM archives WHERE id = $1", [id]);

        try {
          await logActivity(
            req.user.id,
            req.user.email,
            "DELETE_ARCHIVE",
            `Usuário ${req.user.email} excluiu o arquivo "${originalname}".`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log de exclusão:", e);
        }

        res.json({ success: true, message: "Arquivo excluído com sucesso." });
      } catch (err) {
        console.error("Erro ao excluir arquivo:", err);
        res.status(500).json({ error: "Erro no servidor ao tentar excluir o arquivo." });
      }
    },
  );

  // --- DOWNLOAD ---
  router.get("/download/:id", isLoggedIn, async (req, res) => {
    try {
      const fileResult = await pool.query(
        "SELECT public_id, originalname, filename, visibility FROM archives WHERE id = $1",
        [req.params.id],
      );

      if (fileResult.rowCount === 0) {
        return res.status(404).send("Arquivo não encontrado.");
      }

      const file = fileResult.rows[0];
      const { role } = req.user;

      const isAllowed =
        role === "admin" ||
        file.visibility === "todos" ||
        (role === "licenciado" && file.visibility === "licenciados") ||
        (role !== "licenciado" && file.visibility === "colaboradores");

      if (!isAllowed) {
        return res.status(403).send("Você não tem permissão para baixar este arquivo.");
      }

      if (!file.filename) {
        return res.status(500).send("URL do arquivo não encontrada no banco de dados.");
      }

      const isRaw = file.filename.includes("/raw/upload/");
      const resourceType = isRaw ? "raw" : "image";

      const urlExtMatch = file.filename.match(/\.([a-zA-Z0-9]+)(?:[\?#]|$)/);
      const extNoDot = urlExtMatch ? urlExtMatch[1] : "";
      const urlExt = extNoDot ? "." + extNoDot : "";

      let cleanName = file.originalname;
      const dotIndex = cleanName.lastIndexOf(".");
      if (dotIndex > -1) cleanName = cleanName.substring(0, dotIndex);
      cleanName = cleanName.replace(/[^a-zA-Z0-9_-]/g, "_");

      const options = {
        resource_type: resourceType,
        secure: true,
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + 300,
      };

      let publicIdToUse = file.public_id;

      if (!isRaw) {
        options.flags = `attachment:${cleanName}`;
        if (extNoDot) options.format = extNoDot;
        if (publicIdToUse.endsWith(urlExt)) {
          publicIdToUse = publicIdToUse.substring(0, publicIdToUse.length - urlExt.length);
        }
      } else {
        if (urlExt && !publicIdToUse.endsWith(urlExt)) {
          publicIdToUse += urlExt;
        }
      }

      const signedUrl = cloudinary.url(publicIdToUse, options);

      try {
        await logActivity(
          req.user.id,
          req.user.email,
          "DOWNLOAD_ARCHIVE",
          `Usuário ${req.user.email} baixou o arquivo "${file.originalname}".`,
          req.ipAddress,
        );
      } catch (e) {
        console.warn("Falha ao registrar log de download:", e);
      }

      res.json({ downloadUrl: signedUrl });
    } catch (err) {
      console.error("Erro ao gerar link de acesso ao arquivo:", err);
      res.status(500).send("Erro interno ao processar o acesso ao arquivo.");
    }
  });

  return router;
};
