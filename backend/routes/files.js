const express = require("express");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

module.exports = function (pool, cloudinary, upload, logActivity) {
  // --- HELPER: Busca ID da empresa pelo Slug ---
  const getCompanyId = async (slug) => {
    // Se não vier slug ou for undefined, assume ID 1 (V-CORP) como padrão
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
    const { category, search, company } = req.query; // Recebe 'company'
    const { role } = req.user;

    try {
      // 1. Resolve o ID da empresa
      const companyId = await getCompanyId(company);

      // 2. Inicia os arrays de parâmetros e cláusulas
      // O primeiro parâmetro será sempre o company_id
      const params = [companyId];
      let whereClauses = ["company_id = $1"];

      // Filtros de Role (Visibilidade)
      if (role === "licenciado") {
        whereClauses.push(
          "(visibility = 'todos' OR visibility = 'licenciados')",
        );
      } else if (role !== "admin") {
        whereClauses.push(
          "(visibility = 'todos' OR visibility = 'colaboradores')",
        );
      }

      // Filtro de Categoria
      if (category) {
        params.push(category);
        // Usa params.length para pegar o índice dinâmico ($2, $3...)
        whereClauses.push(`category = $${params.length}`);
      }

      // Filtro de Busca
      if (search) {
        params.push(`%${search}%`);
        whereClauses.push(
          `(originalname ILIKE $${params.length} OR folder ILIKE $${params.length})`,
        );
      }

      // Monta a query final
      const whereString = `WHERE ${whereClauses.join(" AND ")}`;
      const filesSql = `SELECT * FROM files ${whereString} ORDER BY folder ASC, originalname ASC`;

      const filesResult = await pool.query(filesSql, params);

      // Agrupa por pasta
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

  // --- LISTAR CATEGORIAS ---
  router.get("/categories", isLoggedIn, async (req, res) => {
    const { role } = req.user;
    const { company } = req.query; // Recebe company

    try {
      const companyId = await getCompanyId(company);

      // Inicia com filtro de empresa e visibilidade
      const params = [companyId];
      let whereClauses = ["company_id = $1"];

      if (role === "licenciado") {
        whereClauses.push(
          "(visibility = 'todos' OR visibility = 'licenciados')",
        );
      } else if (role !== "admin") {
        whereClauses.push(
          "(visibility = 'todos' OR visibility = 'colaboradores')",
        );
      }

      const whereString = `WHERE ${whereClauses.join(" AND ")}`;
      const query = `SELECT DISTINCT category FROM files ${whereString} ORDER BY category ASC`;

      const result = await pool.query(query, params);
      res.json(result.rows.map((row) => row.category));
    } catch (err) {
      console.error("Erro ao buscar categorias de arquivos:", err);
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
        // Se você mudou a função para síncrona (como recomendado), remova o 'await' abaixo
        const companyId = await getCompanyId(company);

        // 1. Deteção inteligente do tipo de arquivo (Imagem ou Documento Raw)
        const isImage = req.file.mimetype.startsWith("image/");
        const resourceType = isImage ? "image" : "raw";

        // 2. Cria a Promise para aguardar o upload
        const uploadResult = await new Promise((resolve, reject) => {
          // Extrai a extensão do arquivo REAL anexado
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

        // INSERÇÃO NO BANCO
        const result = await pool.query(
          `INSERT INTO files 
           (filename, originalname, category, folder, visibility, public_id, company_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           RETURNING *`,
          [
            fileUrl,
            originalname,
            category,
            folder,
            visibility,
            publicId,
            companyId,
          ],
        );

        try {
          await logActivity(
            req.user?.id || null,
            req.user?.email || "desconhecido",
            "CREATE_FILE",
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

      // Nota: Não estamos permitindo mudar a empresa na edição por enquanto para simplificar,
      // mas mantemos os outros campos.
      try {
        const result = await pool.query(
          "UPDATE files SET originalname = $1, category = $2, folder = $3, visibility = $4 WHERE id = $5 RETURNING *",
          [originalname, category, folder, visibility, id],
        );
        if (result.rowCount === 0)
          return res.status(404).json({ error: "Arquivo não encontrado." });

        try {
          await logActivity(
            req.user.id,
            req.user.email,
            "UPDATE_FILE",
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

  // --- EXCLUIR (Mantido igual) ---
  router.delete(
    "/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      try {
        const fileResult = await pool.query(
          "SELECT public_id, filename, originalname FROM files WHERE id = $1",
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

        await pool.query("DELETE FROM files WHERE id = $1", [id]);

        try {
          await logActivity(
            req.user.id,
            req.user.email,
            "DELETE_FILE",
            `Usuário ${req.user.email} excluiu o arquivo "${originalname}".`,
            req.ipAddress,
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
    },
  );

  // --- DOWNLOAD ---
  router.get("/download/:id", isLoggedIn, async (req, res) => {
    try {
      const fileResult = await pool.query(
        "SELECT public_id, originalname, filename, visibility FROM files WHERE id = $1",
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
        return res
          .status(403)
          .send("Você não tem permissão para baixar este arquivo.");
      }

      if (!file.filename) {
        return res
          .status(500)
          .send("URL do arquivo não encontrada no banco de dados.");
      }

      // 1. Descobre a base correta do arquivo lendo a URL salva no banco
      const isRaw = file.filename.includes("/raw/upload/");
      const resourceType = isRaw ? "raw" : "image";

      // 2. Extrai a extensão exata que está salva no Cloudinary (ex: pdf, jpg, docx)
      const urlExtMatch = file.filename.match(/\.([a-zA-Z0-9]+)(?:[\?#]|$)/);
      const extNoDot = urlExtMatch ? urlExtMatch[1] : "";
      const urlExt = extNoDot ? "." + extNoDot : "";

      // 3. Nome limpo SEM a extensão (Cloudinary dá Erro 400 se tiver ponto no fl_attachment)
      let cleanName = file.originalname;
      const dotIndex = cleanName.lastIndexOf(".");
      if (dotIndex > -1) {
        cleanName = cleanName.substring(0, dotIndex);
      }
      cleanName = cleanName.replace(/[^a-zA-Z0-9_-]/g, "_");

      const options = {
        resource_type: resourceType,
        secure: true,
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + 300,
      };

      let publicIdToUse = file.public_id;

      // 4. Aplica regras diferentes para RAW vs IMAGES/PDFs
      if (!isRaw) {
        // Se for imagem ou PDF (salvo como image), aplicamos o attachment sem a extensão
        options.flags = `attachment:${cleanName}`;
        if (extNoDot) {
          options.format = extNoDot;
        }
        // Limpa a extensão do public_id caso exista, para evitar duplicação (.pdf.pdf)
        if (publicIdToUse.endsWith(urlExt)) {
          publicIdToUse = publicIdToUse.substring(
            0,
            publicIdToUse.length - urlExt.length,
          );
        }
      } else {
        // Se for raw (como o DOCX), o public_id precisa obrigatoriamente ter a extensão
        if (urlExt && !publicIdToUse.endsWith(urlExt)) {
          publicIdToUse += urlExt;
        }
      }

      const signedUrl = cloudinary.url(publicIdToUse, options);

      try {
        await logActivity(
          req.user.id,
          req.user.email,
          "DOWNLOAD_FILE",
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
