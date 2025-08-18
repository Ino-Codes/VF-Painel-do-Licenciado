const express = require('express');
const path = require('path');
const https = require('https');
const mime = require('mime-types');
const router = express.Router();

module.exports = function(pool, cloudinary, upload) {

  router.get("/", async (req, res) => {
    const { category, search, role } = req.query;
    try {
      let whereClauses = [];
      const params = [];
  
      if (role === "licenciado") {
        whereClauses.push("visibility = 'public'");
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
        if (!acc[folderName]) {
          acc[folderName] = [];
        }
        acc[folderName].push(file);
        return acc;
      }, {});
  
      res.json(groupedByFolder);
    } catch (err) {
      console.error("Erro ao buscar arquivos:", err);
      res.status(500).json({ error: "Erro ao buscar arquivos" });
    }
  });

  router.post("/", upload.single("file"), async (req, res) => {
    const { originalname, category, folder, visibility } = req.body;
    if (!req.file)
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    try {
      const resourceType = req.file.mimetype.startsWith("image") ? "image" : "raw";
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ resource_type: resourceType, folder: category, tags: [category, folder] }, (error, result) => {
            if (error) reject(error);
            resolve(result);
          })
          .end(req.file.buffer);
      });
  
      const fileUrl = uploadResult.secure_url;
      const result = await pool.query(
        "INSERT INTO files (filename, originalname, category, folder, visibility) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [fileUrl, originalname, category, folder, visibility]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro no upload de arquivo:", err);
      res.status(500).json({ error: "Erro no servidor durante o upload." });
    }
  });

  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { originalname, category, folder, visibility } = req.body;
    try {
      const result = await pool.query(
        "UPDATE files SET originalname = $1, category = $2, folder = $3, visibility = $4 WHERE id = $5 RETURNING *",
        [originalname, category, folder, visibility, id]
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Arquivo não encontrado." });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao editar arquivo:", err);
      res.status(500).json({ error: "Erro ao editar arquivo." });
    }
  });

  router.get("/download/:id", async (req, res) => {
    try {
      const fileResult = await pool.query(
        "SELECT filename, originalname FROM files WHERE id = $1",
        [req.params.id]
      );
      if (fileResult.rowCount === 0) {
        return res.status(404).send("Arquivo não encontrado.");
      }
      const { filename: fileUrl, originalname } = fileResult.rows[0];
      const fileExtension = path.extname(fileUrl).toLowerCase();
      
      if (fileExtension === '.pdf') {
        const correctedUrl = fileUrl.replace('/image/upload', '/raw/upload');
        res.redirect(correctedUrl);
      } else {
        const resourceType = "image";
        const publicIdMatch = fileUrl.match(/\/v\d+\/(.+)\.[^/.]+$/);
        const publicId = publicIdMatch ? decodeURIComponent(publicIdMatch[1]) : null;
  
        if (!publicId) {
          return res.status(500).send("Não foi possível analisar a URL do arquivo.");
        }
        
        const signedUrl = cloudinary.url(publicId, {
          resource_type: resourceType,
          sign_url: true,
          expires_at: Math.floor(Date.now() / 1000) + 120,
          flags: [`attachment:${originalname}`],
        });
        res.redirect(signedUrl);
      }
    } catch (err) {
      console.error("Erro ao gerar link de acesso ao arquivo:", err);
      res.status(500).send("Erro interno ao processar o acesso ao arquivo.");
    }
  });

  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const fileResult = await pool.query("SELECT filename FROM files WHERE id = $1", [id]);
      if (fileResult.rowCount === 0) {
        return res.status(404).json({ error: "Arquivo não encontrado." });
      }
      const fileUrl = fileResult.rows[0].filename;
      if (fileUrl) {
        const resourceType = fileUrl.includes("/image/") ? "image" : "raw";
        const publicIdMatch = fileUrl.match(/\/v\d+\/(.+)\.\w+$/);
        const publicId = publicIdMatch ? publicIdMatch[1] : null;
        if (publicId) {
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        }
      }
      await pool.query("DELETE FROM files WHERE id = $1", [id]);
      res.json({ success: true, message: "Arquivo excluído com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir arquivo:", err);
      res.status(500).json({ error: "Erro no servidor ao tentar excluir o arquivo." });
    }
  });

  router.get("/categories", async (req, res) => {
    const { role } = req.query;
    try {
      let query = "SELECT DISTINCT category FROM files";
      if (role === "licenciado") {
        query += " WHERE visibility = 'public'";
      }
      query += " ORDER BY category ASC";
      const result = await pool.query(query);
      res.json(result.rows.map((row) => row.category));
    } catch (err) {
      console.error("Erro ao buscar categorias de arquivos:", err);
      res.status(500).json({ error: "Erro ao buscar categorias." });
    }
  });

  return router;
};