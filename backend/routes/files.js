const express = require("express");
const path = require("path");
const https = require("https");
const mime = require("mime-types");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

module.exports = function (pool, cloudinary, upload, logActivity) {
  router.get("/", isLoggedIn, async (req, res) => {
    const { category, search } = req.query;
    const { role } = req.user;
    try {
      let whereClauses = [];
      const params = [];

      if (role === "licenciado") {
        whereClauses.push(
          "(visibility = 'todos' OR visibility = 'licenciados')"
        );
      } else if (role !== "admin") {
        whereClauses.push(
          "(visibility = 'todos' OR visibility = 'colaboradores')"
        );
      }

      if (category) {
        params.push(category);
        whereClauses.push(`category = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        whereClauses.push(
          `(originalname ILIKE $${params.length} OR folder ILIKE $${params.length})`
        );
      }

      const whereString =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const filesSql = `SELECT * FROM files ${whereString} ORDER BY folder ASC, originalname ASC`;

      const filesResult = await pool.query(filesSql, params);

      const groupedByFolder = filesResult.rows.reduce((acc, file) => {
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

  router.get("/categories", isLoggedIn, async (req, res) => {
    const { role } = req.user;
    try {
      let whereClause = "";

      if (role === "licenciado") {
        whereClause =
          "WHERE (visibility = 'todos' OR visibility = 'licenciados')";
      } else if (role !== "admin") {
        whereClause =
          "WHERE (visibility = 'todos' OR visibility = 'colaboradores')";
      }

      const query = `SELECT DISTINCT category FROM files ${whereClause} ORDER BY category ASC`;
      const result = await pool.query(query);
      res.json(result.rows.map((row) => row.category));
    } catch (err) {
      console.error("Erro ao buscar categorias de arquivos:", err);
      res.status(500).json({ error: "Erro ao buscar categorias." });
    }
  });

  // 📤 Upload
  router.post(
    "/",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    upload.single("file"),
    async (req, res) => {
      const { originalname, category, folder, visibility } = req.body;
      if (!req.file)
        return res.status(400).json({ error: "Nenhum arquivo enviado." });

      try {
        const resourceType = "image";
        const uploadResult = await new Promise((resolve, reject) => {
          // Para raw, o public_id DEVE incluir a extensão completa
          const publicIdWithExtension =
            resourceType === "raw" &&
            originalname.toLowerCase().endsWith(".pdf")
              ? originalname // Use o nome completo COM .pdf
              : undefined;

          cloudinary.uploader
            .upload_stream(
              {
                resource_type: resourceType,
                folder: category,
                tags: [category, folder],
                ...(publicIdWithExtension && {
                  public_id: publicIdWithExtension,
                }),
              },
              (error, result) => {
                if (error) reject(error);
                resolve(result);
              }
            )
            .end(req.file.buffer);
        });

        const { secure_url: fileUrl, public_id: publicId } = uploadResult;

        const result = await pool.query(
          "INSERT INTO files (filename, originalname, category, folder, visibility, public_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          [fileUrl, originalname, category, folder, visibility, publicId]
        );

        try {
          await logActivity(
            req.user?.id || null,
            req.user?.email || "desconhecido",
            "CREATE_FILE",
            `Usuário ${
              req.user?.email || "desconhecido"
            } enviou o arquivo "${originalname}".`,
            req.ipAddress
          );
        } catch (e) {
          console.warn("Falha ao registrar log de upload:", e);
        }

        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro no upload de arquivo:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      }
    }
  );

  // ✏️ Atualizar metadados
  router.put(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { originalname, category, folder, visibility } = req.body;
      try {
        const result = await pool.query(
          "UPDATE files SET originalname = $1, category = $2, folder = $3, visibility = $4 WHERE id = $5 RETURNING *",
          [originalname, category, folder, visibility, id]
        );
        if (result.rowCount === 0)
          return res.status(404).json({ error: "Arquivo não encontrado." });

        try {
          await logActivity(
            req.user.id,
            req.user.email,
            "UPDATE_FILE",
            `Usuário ${req.user.email} atualizou o arquivo "${originalname}" (ID: ${id}).`,
            req.ipAddress
          );
        } catch (e) {
          console.warn("Falha ao registrar log de atualização:", e);
        }

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao editar arquivo:", err);
        res.status(500).json({ error: "Erro ao editar arquivo." });
      }
    }
  );

  // 🗑️ Excluir
  router.delete(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      try {
        const fileResult = await pool.query(
          "SELECT public_id, filename, originalname FROM files WHERE id = $1",
          [id]
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

        await pool.query("DELETE FROM files WHERE id = $1", [id]);

        try {
          await logActivity(
            req.user.id,
            req.user.email,
            "DELETE_FILE",
            `Usuário ${req.user.email} excluiu o arquivo "${originalname}".`,
            req.ipAddress
          );
        } catch (e) {
          console.warn("Falha ao registrar log de exclusão:", e);
        }

        res.json({ success: true, message: "Arquivo excluído com sucesso." });
      } catch (err) {
        console.error("Erro ao excluir arquivo:", err);
        res
          .status(500)
          .json({ error: "Erro no servidor ao tentar excluir o arquivo." });
      }
    }
  );

  // Rota de download segura, que envia o arquivo em vez de redirecionar
  router.get("/download/:id", isLoggedIn, async (req, res) => {
    try {
      // 1. Verifica se o arquivo existe e se o usuário tem permissão para acessá-lo
      const fileResult = await pool.query(
        "SELECT public_id, originalname, filename, visibility FROM files WHERE id = $1",
        [req.params.id]
      );

      if (fileResult.rowCount === 0) {
        return res.status(404).send("Arquivo não encontrado.");
      }

      const file = fileResult.rows[0];
      const { role } = req.user;

      // 2. Lógica de autorização (consistente com a rota de listagem)
      const isAllowed =
        role === "admin" ||
        file.visibility === "todos" ||
        (role === "licenciado" && file.visibility === "licenciados") ||
        (role !== "licenciado" && file.visibility === "colaboradores");

      if (!isAllowed) {
        return res
          .status(403)
          .send("Você não tem permissão para baixar este arquivo.");
      }

      if (!file.filename) {
        return res
          .status(500)
          .send("URL do arquivo não encontrada no banco de dados.");
      }

      // 3. Gera uma URL assinada do Cloudinary que força o download com o nome correto
      const resourceType =
        file.filename.includes("/image/") &&
        !file.originalname.toLowerCase().endsWith(".pdf")
          ? "image"
          : "raw";

      // Lógica unificada para forçar o download com o nome correto para TODOS os tipos de arquivo.
      let sanitizedFilename = file.originalname.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      // Para PDFs raw, garante que o nome tenha a extensão .pdf
      if (
        resourceType === "raw" &&
        file.originalname.toLowerCase().endsWith(".pdf")
      ) {
        if (!sanitizedFilename.toLowerCase().endsWith(".pdf")) {
          sanitizedFilename = sanitizedFilename + ".pdf";
        }
      }

      const options = {
        resource_type: resourceType,
        flags: `attachment:${sanitizedFilename}`,
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + 300,
      };

      let publicIdToUse = file.public_id;

      if (
        resourceType === "raw" &&
        file.originalname.toLowerCase().endsWith(".pdf")
      ) {
        publicIdToUse = file.public_id.endsWith(".pdf")
          ? file.public_id
          : `${file.public_id}.pdf`;
      }

      // Use publicIdToUse aqui, não file.public_id
      const signedUrl = cloudinary.url(publicIdToUse, options);

      try {
        await logActivity(
          req.user.id,
          req.user.email,
          "DOWNLOAD_FILE",
          `Usuário ${req.user.email} baixou o arquivo "${file.originalname}".`,
          req.ipAddress
        );
      } catch (e) {
        console.warn("Falha ao registrar log de download:", e);
      }

      // 4. Envia a URL segura para o frontend
      res.json({ downloadUrl: signedUrl });
    } catch (err) {
      console.error("Erro ao gerar link de acesso ao arquivo:", err);
      res.status(500).send("Erro interno ao processar o acesso ao arquivo.");
    }
  });

  return router;
};
