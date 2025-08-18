const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const cloudinary = require("cloudinary").v2;
const sgMail = require("@sendgrid/mail");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3001;

// --- CONFIGURAÇÕES ---
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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

// --- IMPORTAÇÃO DAS ROTAS ---
const authRoutes = require("./routes/auth.js");
const userRoutes = require("./routes/users.js");
const noticeRoutes = require("./routes/notices.js");
const fileRoutes = require("./routes/files.js");
const videoRoutes = require("./routes/videos.js");
const faqRoutes = require("./routes/faq.js");
const logRoutes = require("./routes/logs.js");
const courseRoutes = require("./routes/courses.js");

// --- USO DAS ROTAS ---
app.use("/api/auth", authRoutes(pool, sgMail, logActivity));
app.use("/api/users", userRoutes(pool, cloudinary, upload, logActivity));
app.use("/api/notices", noticeRoutes(pool));
app.use("/api/files", fileRoutes(pool, cloudinary, upload, path));
app.use("/api/videos", videoRoutes(pool));
app.use("/api/faq", faqRoutes(pool, cloudinary, upload));
app.use("/api/admin/logs", logRoutes(pool));
app.use("/api/admin/courses", courseRoutes(pool));

// --- INICIALIZAÇÃO DO SERVIDOR E BANCO ---
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

  const coursesTable = `
    CREATE TABLE IF NOT EXISTS courses (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      thumbnail_url TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  const modulesTable = `
    CREATE TABLE IF NOT EXISTS modules (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      module_order INTEGER NOT NULL
    );`;

  const lessonsTable = `
    CREATE TABLE IF NOT EXISTS lessons (
      id SERIAL PRIMARY KEY,
      module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content_type TEXT NOT NULL, -- 'video', 'text'
      content_data TEXT, -- URL do vídeo, texto em markdown, etc.
      lesson_order INTEGER NOT NULL
    );`;

  const userCoursesTable = `
    CREATE TABLE IF NOT EXISTS user_courses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      enrolled_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, course_id)
    );`;

  const progressTable = `
    CREATE TABLE IF NOT EXISTS progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, lesson_id)
    );`;

  const certificatesTable = `
    CREATE TABLE IF NOT EXISTS certificates (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      completion_date TIMESTAMPTZ DEFAULT NOW(),
      unique_code TEXT NOT NULL UNIQUE
    );`;

  try {
    await pool.query(userTable);
    await pool.query(noticeTable);
    await pool.query(fileTable);
    await pool.query(videoTable);
    await pool.query(logsTable);
    await pool.query(faqTable);
    await pool.query(coursesTable);
    await pool.query(modulesTable);
    await pool.query(lessonsTable);
    await pool.query(userCoursesTable);
    await pool.query(progressTable);
    await pool.query(certificatesTable);

    console.log("Tabelas verificadas/criadas com sucesso no PostgreSQL.");
  } catch (err) {
    console.error("Erro ao criar tabelas:", err);
  }
};

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  createTables();
});
