const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const cloudinary = require("cloudinary").v2;
const sgMail = require("@sendgrid/mail");
const crypto = require("crypto");
const csv = require("csv-parser");
const { Readable } = require("stream");
const https = require("https");
const mime = require("mime-types");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const port = process.env.PORT || 3001;

// --- CONFIGURAÇÕES ---

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Conexão com o PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuração do Multer para upload em memória
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- INICIALIZAÇÃO DO BANCO DE DADOS ---
const createTables = async () => {
  const userTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
      role TEXT NOT NULL, nome TEXT, avatar_url TEXT,
      reset_token TEXT, reset_token_expires TIMESTAMPTZ
    );`;
  const noticeTable = `
    CREATE TABLE IF NOT EXISTS notices (
      id SERIAL PRIMARY KEY, message TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );`;
  const fileTable = `
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY, filename TEXT, originalname TEXT, category TEXT,
      folder TEXT,
      visibility TEXT DEFAULT 'public', 
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    );`;
  const videoTable = `
    CREATE TABLE IF NOT EXISTS videos (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      youtube_url TEXT NOT NULL UNIQUE,
      visibility TEXT DEFAULT 'public', 
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`;
  const logsTable = `
    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_email TEXT, action TEXT NOT NULL, details TEXT, ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`;
  const faqTable = `
    CREATE TABLE IF NOT EXISTS faq (
      id SERIAL PRIMARY KEY, category TEXT NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL,
      document_url TEXT, document_originalname TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  try {
    await pool.query(userTable);
    await pool.query(noticeTable);
    await pool.query(fileTable);
    await pool.query(videoTable);
    await pool.query(logsTable);
    await pool.query(faqTable);
    console.log("Tabelas verificadas/criadas com sucesso no PostgreSQL.");
  } catch (err) {
    console.error("Erro ao criar tabelas:", err);
  }
};

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  req.ipAddress =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  next();
});

// --- FUNÇÃO DE LOGGING ---
const logActivity = async (userId, userEmail, action, details, ipAddress) => {
  try {
    const sql = `INSERT INTO activity_logs (user_id, user_email, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)`;
    await pool.query(sql, [userId, userEmail, action, details, ipAddress]);
  } catch (err) {
    console.error("Falha ao registrar log de atividade:", err);
  }
};

// --- ROTAS DA API ---

// AUTENTICAÇÃO
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      logActivity(
        null,
        email,
        "LOGIN_FAIL",
        "Tentativa de login falhou.",
        req.ipAddress
      );
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    logActivity(
      user.id,
      user.email,
      "LOGIN_SUCCESS",
      "Usuário logado com sucesso.",
      req.ipAddress
    );
    delete user.password;
    delete user.reset_token;
    delete user.reset_token_expires;
    res.json(user);
  } catch (err) {
    console.error("Erro na rota /api/login:", err);
    res.status(500).send({ error: "Erro no servidor" });
  }
});

// REDEFINIR SENHA
app.post("/api/solicitar-redefinicao", async (req, res) => {
  const { email } = req.body;
  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.json({
        message:
          "Se um e-mail correspondente for encontrado em nosso sistema, um link para redefinição de senha será enviado.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const tokenExpiry = new Date(Date.now() + 900000); // Em milissegundos

    await pool.query(
      "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
      [hashedToken, tokenExpiry, user.id]
    );

    const resetUrl = `https://painel.valorfiscal.com/reset-password?token=${resetToken}`;

    const msg = {
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: "Redefinição de Senha - Painel do Licenciado",
      html: `<p>Olá, ${user.nome}.</p><p>Você solicitou a redefinição da sua senha do Painel do Licenciado. Por favor, clique no link abaixo para criar uma nova senha:</p><a href="${resetUrl}" target="_blank">Redefinir Minha Senha</a><p>Este link é válido por 15 minutos. Se você não solicitou esta alteração, por favor, ignore este e-mail.</p><p>Atenciosamente,<br>Equipe Valor Fiscal</p>`,
    };

    await sgMail.send(msg);

    res.json({
      message:
        "Se um e-mail correspondente for encontrado em nosso sistema, um link para redefinição de senha será enviado.",
    });
  } catch (err) {
    console.error("Erro ao solicitar redefinição de senha:", err);
    res.status(500).send({ error: "Erro no servidor" });
  }
});

app.post("/api/redefinir-senha", async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res
      .status(400)
      .json({ error: "Token e nova senha são obrigatórios." });
  }

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const userResult = await pool.query(
      "SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
      [hashedToken]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(400).json({
        error:
          "Token inválido ou expirado. Por favor, solicite a redefinição novamente.",
      });
    }

    const newPasswordHash = await bcrypt.hash(password, 10);
    await pool.query(
      "UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [newPasswordHash, user.id]
    );

    logActivity(
      user.id,
      user.email,
      "PASSWORD_RESET",
      "Senha redefinida com sucesso através do link.",
      req.ipAddress
    );
    res.json({ message: "Senha redefinida com sucesso!" });
  } catch (err) {
    console.error("Erro ao redefinir senha:", err);
    res.status(500).send({ error: "Erro no servidor" });
  }
});

// MURAL DE AVISOS (DASHBOARD)
app.get("/api/notices", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM notices ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar avisos:", err);
    res.status(500).json({ error: "Erro ao buscar avisos." });
  }
});

app.post("/api/admin/notice", async (req, res) => {
  const { message } = req.body;
  try {
    await pool.query("INSERT INTO notices (message) VALUES ($1)", [message]);
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Erro ao criar aviso:", err);
    res.status(500).json({ error: "Erro ao criar aviso." });
  }
});

app.put("/api/admin/notices/:id", async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  try {
    const result = await pool.query(
      "UPDATE notices SET message = $1 WHERE id = $2 RETURNING *",
      [message, id]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Aviso não encontrado." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao editar aviso:", err);
    res.status(500).json({ error: "Erro ao editar aviso." });
  }
});

app.delete("/api/admin/notices/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM notices WHERE id = $1", [id]);
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Aviso não encontrado." });
    res.json({ success: true, message: "Aviso excluído com sucesso." });
  } catch (err) {
    console.error("Erro ao excluir aviso:", err);
    res.status(500).json({ error: "Erro ao excluir aviso." });
  }
});

// --- CENTRAL DE DOCUMENTOS (COM CONTROLE DE VISIBILIDADE) ---
app.get("/api/files", async (req, res) => {
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

app.post("/api/files", upload.single("file"), async (req, res) => {
  const { originalname, category, folder, visibility } = req.body;
  if (!req.file)
    return res.status(400).json({ error: "Nenhum arquivo enviado." });
  try {
    const resourceType = req.file.mimetype.startsWith("image")
      ? "image"
      : "raw";

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: resourceType }, (error, result) => {
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

app.put("/api/files/:id", async (req, res) => {
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

app.get("/api/files/download/:id", async (req, res) => {
  try {
    const fileResult = await pool.query(
      "SELECT filename, originalname FROM files WHERE id = $1",
      [req.params.id]
    );

    if (fileResult.rowCount === 0) {
      return res.status(404).send("Arquivo não encontrado.");
    }

    const { filename: fileUrl, originalname } = fileResult.rows[0];

    // Força download no Cloudinary
    const downloadUrl = fileUrl.replace(
      "/upload/",
      `/upload/fl_attachment:${encodeURIComponent(originalname)}/`
    );

    return res.redirect(downloadUrl);
  } catch (err) {
    console.error("Erro ao gerar link de download:", err);
    res.status(500).send("Erro interno ao processar o download.");
  }
});

app.delete("/api/files/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const fileResult = await pool.query(
      "SELECT filename FROM files WHERE id = $1",
      [id]
    );

    if (fileResult.rowCount === 0) {
      return res.status(404).json({ error: "Arquivo não encontrado." });
    }

    const fileUrl = fileResult.rows[0].filename;

    if (fileUrl) {
      const resourceType = fileUrl.includes("/image/") ? "image" : "raw";

      const publicIdMatch = fileUrl.match(/\/v\d+\/(.+)\.\w+$/);
      const publicId = publicIdMatch ? publicIdMatch[1] : null;

      if (publicId) {
        const destructionResult = await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType,
        });

        console.log(
          `Tentativa de exclusão no Cloudinary para public_id '${publicId}' com resource_type '${resourceType}'. Resultado:`,
          destructionResult.result
        );
      } else {
        console.warn(`Não foi possível extrair o public_id da URL: ${fileUrl}`);
      }
    }

    await pool.query("DELETE FROM files WHERE id = $1", [id]);

    res.json({ success: true, message: "Arquivo excluído com sucesso." });
  } catch (err) {
    console.error("Erro ao excluir arquivo:", err);
    res
      .status(500)
      .json({ error: "Erro no servidor ao tentar excluir o arquivo." });
  }
});

app.get("/api/files/categories", async (req, res) => {
  const { role } = req.query;
  try {
    let query = "SELECT DISTINCT category FROM files";
    const params = [];

    if (role === "licenciado") {
      query += " WHERE visibility = 'public'";
    }
    query += " ORDER BY category ASC";

    const result = await pool.query(query, params);
    res.json(result.rows.map((row) => row.category));
  } catch (err) {
    console.error("Erro ao buscar categorias de arquivos:", err);
    res.status(500).json({ error: "Erro ao buscar categorias." });
  }
});

// --- VIDEOS (COM CONTROLE DE VISIBILIDADE) ---
app.get("/api/videos", async (req, res) => {
  const { role } = req.query;
  try {
    let sql = "SELECT * FROM videos";
    if (role === "licenciado") {
      sql += " WHERE visibility = 'public'";
    }
    sql += " ORDER BY created_at DESC";

    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar vídeos:", err);
    res.status(500).json({ error: "Erro ao buscar vídeos" });
  }
});

app.post("/api/videos", async (req, res) => {
  const { title, description, youtube_url, visibility } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO videos (title, description, youtube_url, visibility) VALUES ($1, $2, $3, $4) RETURNING *",
      [title, description, youtube_url, visibility]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao adicionar vídeo:", err);
    res.status(500).json({ error: "Erro ao adicionar vídeo" });
  }
});

app.put("/api/videos/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, youtube_url, visibility } = req.body;
  try {
    const result = await pool.query(
      "UPDATE videos SET title = $1, description = $2, youtube_url = $3, visibility = $4 WHERE id = $5 RETURNING *",
      [title, description, youtube_url, visibility, id]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Vídeo não encontrado." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao editar vídeo:", err);
    res.status(500).json({ error: "Erro ao editar vídeo." });
  }
});

app.delete("/api/videos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM videos WHERE id = $1", [id]);
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Vídeo não encontrado." });
    res.json({ success: true, message: "Vídeo excluído com sucesso." });
  } catch (err) {
    console.error("Erro ao excluir vídeo:", err);
    res.status(500).json({ error: "Erro ao excluir vídeo." });
  }
});

// ADMINISTRAÇÃO DE USUÁRIOS
app.get("/api/admin/users", async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  try {
    const offset = (page - 1) * limit;
    let whereClause = "";
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE nome ILIKE $1 OR email ILIKE $1`;
    }
    const countSql = `SELECT COUNT(*) FROM users ${whereClause}`;
    const usersSql = `SELECT id, nome, email, role, avatar_url FROM users ${whereClause} ORDER BY nome ASC LIMIT $${
      params.length + 1
    } OFFSET $${params.length + 2}`;
    const [countResult, usersResult] = await Promise.all([
      pool.query(countSql, params),
      pool.query(usersSql, [...params, limit, offset]),
    ]);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    res.json({
      users: usersResult.rows,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    console.error("Erro ao buscar usuários:", err);
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

app.post("/api/admin/users", async (req, res) => {
  const { nome, email, password, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (nome, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
      [nome, email, hash, role]
    );
    logActivity(
      null,
      email,
      "CREATE_USER",
      `Usuário ${email} (${role}) foi criado.`,
      req.ipAddress
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error("Erro ao criar usuário:", err);
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

app.put("/api/admin/users/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, role } = req.body;
  try {
    const result = await pool.query(
      "UPDATE users SET nome = $1, role = $2 WHERE id = $3",
      [nome, role, id]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Usuário não encontrado." });
    logActivity(
      id,
      null,
      "UPDATE_USER_ADMIN",
      `Dados do usuário ID ${id} foram atualizados para nome: ${nome}, role: ${role}.`,
      req.ipAddress
    );
    res.json({ success: true, message: "Usuário atualizado com sucesso." });
  } catch (err) {
    console.error("Erro ao atualizar usuário:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// ROTA DE EXCLUSÃO DE USUÁRIO CORRIGIDA COM TRANSAÇÃO
app.delete("/api/admin/users/:id", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      "SELECT email FROM users WHERE id = $1",
      [id]
    );
    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(404).json({ error: "Usuário não encontrado." });
    }
    const userEmail = userResult.rows[0].email;

    await client.query(
      "UPDATE activity_logs SET user_id = NULL WHERE user_id = $1",
      [id]
    );

    await client.query("DELETE FROM users WHERE id = $1", [id]);

    const logSql =
      "INSERT INTO activity_logs (user_id, user_email, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)";
    const logValues = [
      null,
      userEmail,
      "DELETE_USER",
      `Usuário ${userEmail} (ID: ${id}) foi excluído.`,
      req.ipAddress,
    ];
    await client.query(logSql, logValues);

    await client.query("COMMIT");

    res.json({ success: true, message: "Usuário excluído com sucesso." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao excluir usuário:", err);
    res
      .status(500)
      .json({ error: "Erro no servidor ao tentar excluir usuário." });
  } finally {
    client.release();
  }
});

// ROTA PARA INCLUSÃO DE USUÁRIOS EM MASSA
app.post(
  "/api/admin/users/bulk-upload",
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo CSV enviado." });
    }

    const results = [];
    const errors = [];
    let successCount = 0;

    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        for (const user of results) {
          const { nome, email, password, role } = user;

          if (!nome || !email || !password || !role) {
            errors.push(
              `Dados incompletos para o e-mail: ${email || "desconhecido"}.`
            );
            continue;
          }

          try {
            const existingUser = await pool.query(
              "SELECT id FROM users WHERE email = $1",
              [email]
            );
            if (existingUser.rowCount > 0) {
              errors.push(`E-mail já cadastrado: ${email}.`);
              continue;
            }

            const hash = await bcrypt.hash(password, 10);
            await pool.query(
              "INSERT INTO users (nome, email, password, role) VALUES ($1, $2, $3, $4)",
              [nome, email, hash, role]
            );

            logActivity(
              null,
              email,
              "BULK_CREATE_USER",
              `Usuário ${email} criado via importação em massa.`,
              req.ipAddress
            );
            successCount++;
          } catch (dbError) {
            console.error(`Erro ao inserir usuário ${email}:`, dbError);
            errors.push(`Erro de banco de dados para o e-mail: ${email}.`);
          }
        }

        res.json({
          message: "Processamento do CSV finalizado.",
          successCount,
          errorCount: errors.length,
          errors,
        });
      });
  }
);

// PERFIL DO USUÁRIO
app.post("/api/users/:id/avatar", upload.single("avatar"), async (req, res) => {
  const { id } = req.params;
  if (!req.file)
    return res.status(400).json({ error: "Nenhum arquivo enviado." });
  try {
    const userResult = await pool.query(
      "SELECT avatar_url FROM users WHERE id = $1",
      [id]
    );
    const oldAvatarUrl = userResult.rows[0]?.avatar_url;
    if (oldAvatarUrl) {
      const publicId = oldAvatarUrl.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: "image" }, (error, result) => {
          if (error) reject(error);
          resolve(result);
        })
        .end(req.file.buffer);
    });
    const newAvatarUrl = uploadResult.secure_url;
    const updateResult = await pool.query(
      "UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING avatar_url",
      [newAvatarUrl, id]
    );
    logActivity(
      id,
      null,
      "UPDATE_AVATAR",
      "Foto de perfil atualizada.",
      req.ipAddress
    );
    res.json({ success: true, avatarUrl: updateResult.rows[0].avatar_url });
  } catch (err) {
    console.error("Erro no upload de avatar:", err);
    res.status(500).json({ error: "Erro no servidor durante o upload." });
  }
});

app.put("/api/users/:id/profile", async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;
  try {
    const result = await pool.query(
      "UPDATE users SET nome = $1 WHERE id = $2 RETURNING *",
      [nome, id]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Usuário não encontrado." });
    const updatedUser = result.rows[0];
    delete updatedUser.password;
    delete updatedUser.reset_token;
    delete updatedUser.reset_token_expires;
    logActivity(
      id,
      null,
      "UPDATE_PROFILE",
      "Nome do perfil atualizado.",
      req.ipAddress
    );
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

app.put("/api/users/:id/change-password", async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;
  try {
    const userResult = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [id]
    );
    if (userResult.rowCount === 0)
      return res.status(404).json({ error: "Usuário não encontrado." });
    const storedHash = userResult.rows[0].password;
    if (!(await bcrypt.compare(currentPassword, storedHash))) {
      return res.status(401).json({ error: "A senha atual está incorreta." });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
      newHash,
      id,
    ]);
    logActivity(
      id,
      null,
      "CHANGE_PASSWORD",
      "Senha alterada com sucesso.",
      req.ipAddress
    );
    res.json({ success: true, message: "Senha alterada com sucesso." });
  } catch (err) {
    console.error("Erro ao alterar senha:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

app.delete("/api/users/:id/avatar", async (req, res) => {
  const { id } = req.params;
  try {
    const userResult = await pool.query(
      "SELECT avatar_url FROM users WHERE id = $1",
      [id]
    );
    const oldAvatarUrl = userResult.rows[0]?.avatar_url;
    if (oldAvatarUrl) {
      const publicId = oldAvatarUrl.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }
    const updateResult = await pool.query(
      "UPDATE users SET avatar_url = NULL WHERE id = $1 RETURNING *",
      [id]
    );
    const updatedUser = updateResult.rows[0];
    delete updatedUser.password;
    delete updatedUser.reset_token;
    delete updatedUser.reset_token_expires;
    logActivity(
      id,
      null,
      "REMOVE_AVATAR",
      "Foto de perfil removida.",
      req.ipAddress
    );
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("Erro ao remover avatar:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// LOGS DE ATIVIDADE
app.get("/api/admin/logs", async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  try {
    const offset = (page - 1) * limit;

    let whereClause = "";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE user_email ILIKE $1 OR action ILIKE $1 OR details ILIKE $1 OR to_char(created_at, 'DD/MM/YYYY HH24:MI') ILIKE $1`;
    }

    const countSql = `SELECT COUNT(*) FROM activity_logs ${whereClause}`;

    const queryParams = [...params];
    queryParams.push(limit, offset);

    const limitOffsetParamIndex = params.length + 1;
    const logsSql = `SELECT * FROM activity_logs ${whereClause} ORDER BY created_at DESC LIMIT $${limitOffsetParamIndex} OFFSET $${
      limitOffsetParamIndex + 1
    }`;

    const [countResult, logsResult] = await Promise.all([
      pool.query(countSql, params),
      pool.query(logsSql, queryParams),
    ]);

    const totalCount = parseInt(countResult.rows[0].count, 10);
    res.json({
      logs: logsResult.rows,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    console.error("Erro ao buscar logs de atividade:", err);
    res.status(500).json({ error: "Erro ao buscar logs." });
  }
});

// FAQ (PERGUNTAS FREQUENTES)
app.get("/api/faq", async (req, res) => {
  const { category, search, page = 1, limit = 15 } = req.query;
  try {
    const offset = (page - 1) * limit;
    let whereClauses = [];
    const params = [];

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

app.get("/api/faq/categories", async (req, res) => {
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

app.post("/api/admin/faq", upload.single("document"), async (req, res) => {
  const { category, question, answer } = req.body;
  let document_url = null;
  let document_originalname = null;

  try {
    if (req.file) {
      const resourceType = req.file.mimetype.startsWith("image")
        ? "image"
        : "raw";
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ resource_type: resourceType }, (error, result) => {
            if (error) reject(error);
            resolve(result);
          })
          .end(req.file.buffer);
      });
      document_url = uploadResult.secure_url;
      document_originalname = req.file.originalname;
    }

    const result = await pool.query(
      "INSERT INTO faq (category, question, answer, document_url, document_originalname) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [category, question, answer, document_url, document_originalname]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao criar FAQ:", err);
    res.status(500).json({ error: "Erro ao criar FAQ." });
  }
});

app.delete("/api/admin/faq/:id", async (req, res) => {
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
      const publicIdMatch = docUrl.match(/\/v\d+\/(.+)\.\w+$/);
      const publicId = publicIdMatch ? publicIdMatch[1] : null;

      if (publicId) {
        const destructionResult = await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType,
        });
        console.log(
          `Tentativa de exclusão de anexo de FAQ no Cloudinary. Resultado:`,
          destructionResult.result
        );
      } else {
        console.warn(
          `Não foi possível extrair o public_id da URL do anexo de FAQ: ${docUrl}`
        );
      }
    }

    await pool.query("DELETE FROM faq WHERE id = $1", [id]);
    res.json({ success: true, message: "FAQ excluído com sucesso." });
  } catch (err) {
    console.error("Erro ao excluir FAQ:", err);
    res.status(500).json({ error: "Erro ao excluir FAQ." });
  }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  createTables();
});
