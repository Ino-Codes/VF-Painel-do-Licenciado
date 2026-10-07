const express = require("express");
const router = express.Router();
const { isLoggedIn, checkPermission } = require("../middleware/auth.js");
const { resolveVpartnerId, isLicenciado } = require("../companyAccess.js");

module.exports = function (pool, cloudinary, upload, logActivity) {
  // Onde cada arquivo fica (imagem → Cloudinary, documento → Azure Blob).
  const documentos = require("../storage/documentos.js")(cloudinary);

  // --- HELPER: Busca ID da empresa pelo Slug ---
  const getCompanyId = async (slug) => {
    // "all" → sem filtro por empresa (retorna todas)
    if (slug === "all") return null;
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
  router.get("/", isLoggedIn, checkPermission("files.view"), async (req, res) => {
    const { category, search, company } = req.query; // Recebe 'company'

    try {
      // 1. Resolve o ID da empresa (null = todas). Licenciado é forçado à V-PARTNER.
      let companyId = await getCompanyId(company);
      if (isLicenciado(req)) companyId = await resolveVpartnerId(pool);

      // 2. Inicia os arrays de parâmetros e cláusulas
      const params = [];
      const whereClauses = [];
      if (companyId !== null) {
        params.push(companyId);
        whereClauses.push(`company_id = $${params.length}`);
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
      const whereString = whereClauses.length
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";
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
  router.get("/categories", isLoggedIn, checkPermission("files.view"), async (req, res) => {
    const { company } = req.query; // Recebe company

    try {
      let companyId = await getCompanyId(company);
      if (isLicenciado(req)) companyId = await resolveVpartnerId(pool);

      // Inicia com filtro de empresa (null = todas)
      const params = [];
      const whereClauses = [];
      if (companyId !== null) {
        params.push(companyId);
        whereClauses.push(`company_id = $${params.length}`);
      }

      const whereString = whereClauses.length
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";
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
    checkPermission("files.manage"),
    upload.single("file"),
    async (req, res) => {
      const { originalname, category, folder, company } = req.body;

      if (!req.file)
        return res.status(400).json({ error: "Nenhum arquivo enviado." });

      try {
        // Se você mudou a função para síncrona (como recomendado), remova o 'await' abaixo
        const companyId = await getCompanyId(company);

        // Imagem → Cloudinary; documento → Azure Blob (storage/documentos.js).
        const salvo = await documentos.salvar({
          file: req.file,
          nomeExibicao: originalname,
          pasta: "biblioteca",
          category,
          folder,
        });

        // INSERÇÃO NO BANCO
        const result = await pool.query(
          `INSERT INTO files
           (filename, originalname, category, folder, public_id, company_id,
            storage, blob_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            salvo.url,
            originalname,
            category,
            folder,
            salvo.publicId,
            companyId,
            salvo.storage,
            salvo.blobName,
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
        // Erros esperados (ex.: arquivo acima do limite) têm mensagem própria.
        if (err.httpStatus) {
          return res.status(err.httpStatus).json({ error: err.message });
        }
        console.error("Erro no upload de arquivo:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      }
    },
  );

  // --- EDITAR ---
  router.put(
    "/:id",
    isLoggedIn,
    checkPermission("files.manage"),
    async (req, res) => {
      const { id } = req.params;
      const { originalname, category, folder } = req.body;

      try {
        const result = await pool.query(
          "UPDATE files SET originalname = $1, category = $2, folder = $3 WHERE id = $4 RETURNING *",
          [originalname, category, folder, id],
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
    checkPermission("files.manage"),
    async (req, res) => {
      const { id } = req.params;
      try {
        const fileResult = await pool.query(
          "SELECT public_id, filename, originalname, storage, blob_name FROM files WHERE id = $1",
          [id],
        );
        if (fileResult.rowCount === 0)
          return res.status(404).json({ error: "Arquivo não encontrado." });

        const linha = fileResult.rows[0];
        const { originalname } = linha;

        await documentos.excluir(linha);

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
  router.get("/download/:id", isLoggedIn, checkPermission("files.view"), async (req, res) => {
    try {
      const fileResult = await pool.query(
        "SELECT public_id, originalname, filename, company_id, storage, blob_name FROM files WHERE id = $1",
        [req.params.id],
      );

      if (fileResult.rowCount === 0) {
        return res.status(404).send("Arquivo não encontrado.");
      }

      const file = fileResult.rows[0];
      // Licenciado só baixa conteúdo da V-PARTNER; interno baixa qualquer um.
      const isAllowed =
        !isLicenciado(req) || file.company_id === (await resolveVpartnerId(pool));

      if (!isAllowed) {
        return res
          .status(403)
          .send("Você não tem permissão para baixar este arquivo.");
      }

      // Link temporário (5 min) no provedor onde o arquivo está.
      const signedUrl = await documentos.linkDeDownload(file);

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
