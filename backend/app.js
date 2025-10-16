require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const { Pool } = require("pg");
const cloudinary = require("cloudinary").v2;
const sgMail = require("@sendgrid/mail");

const app = express();
const port = process.env.PORT || 3001;

// --- CONFIGURAÇÕES ---
const allowedOrigins = [
  "https://painel.valorfiscal.com",
  "http://localhost:3000",
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Não permitido pelo CORS"));
    }
  },
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
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
const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 },
});

// --- MIDDLEWARES ---
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
const authRoutes = require("./routes/auth.js")(pool, sgMail, logActivity);
const userRoutes = require("./routes/users.js")(
  pool,
  cloudinary,
  upload,
  logActivity
);
const noticeRoutes = require("./routes/notices.js")(pool); // Simplificado
const fileRoutes = require("./routes/files.js")(pool, cloudinary, upload, path);
const videoRoutes = require("./routes/videos.js")(pool);
const faqRoutes = require("./routes/faq.js")(pool, cloudinary, upload);
const logRoutes = require("./routes/logs.js")(pool);
const courseRoutes = require("./routes/courses.js")(pool, cloudinary, upload);
const certificatesRoutes = require("./routes/certificates.js")(pool);
const quizzesRoutes = require("./routes/quizzes.js")(pool);
const eventRoutes = require("./routes/events.js")(pool);
const enneagramRoutes = require("./routes/enneagram.js")(pool);
const adminAnalyticsRoutes = require("./routes/adminAnalytics.js")(pool);
const cronTriggerRoutes = require("./routes/cronTrigger.js")(pool);
const opportunitiesRoutes = require("./routes/opportunities.js")(pool);

// --- USO DAS ROTAS ---
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/faq", faqRoutes);
app.use("/api/admin/logs", logRoutes);
app.use("/api/admin/courses", courseRoutes);
app.use("/api/certificates", certificatesRoutes);
app.use("/api/quizzes", quizzesRoutes);
app.use("/api/admin/events", eventRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/enneagram", enneagramRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);
app.use("/api/cron", cronTriggerRoutes);
app.use("/api/opportunities", opportunitiesRoutes);

const createTables = async () => {
  const userTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
      role TEXT NOT NULL, nome TEXT, avatar_url TEXT,
      reset_token TEXT, reset_token_expires TIMESTAMPTZ,
      birth_date DATE, cargo TEXT, setor TEXT,
      must_change_password BOOLEAN DEFAULT TRUE,
      unidade TEXT,
      is_vendedor BOOLEAN NOT NULL DEFAULT FALSE, -- ADICIONADO
      gestor_id INTEGER REFERENCES users(id)      -- ADICIONADO
    );`;

  const noticeTable = `
    CREATE TABLE IF NOT EXISTS notices (
      id SERIAL PRIMARY KEY, message TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
      visibility TEXT NOT NULL DEFAULT 'todos'
    );`;

  const fileTable = `
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY, filename TEXT, originalname TEXT, category TEXT,
      folder TEXT, public_id TEXT, visibility TEXT DEFAULT 'public', 
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  const videoTable = `
    CREATE TABLE IF NOT EXISTS videos (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      youtube_url TEXT NOT NULL, visibility TEXT DEFAULT 'public',
      category TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
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
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      thumbnail_url TEXT, is_active BOOLEAN DEFAULT TRUE,
      certificate_template_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  const modulesTable = `
    CREATE TABLE IF NOT EXISTS modules (
      id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL, module_order INTEGER NOT NULL
    );`;

  const lessonsTable = `
    CREATE TABLE IF NOT EXISTS lessons (
      id SERIAL PRIMARY KEY, module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      title TEXT NOT NULL, video_url TEXT, text_content TEXT, lesson_order INTEGER NOT NULL
    );`;

  const userCoursesTable = `
    CREATE TABLE IF NOT EXISTS user_courses (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      enrolled_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(user_id, course_id)
    );`;

  const progressTable = `
    CREATE TABLE IF NOT EXISTS progress (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(user_id, lesson_id)
    );`;

  const certificatesTable = `
    CREATE TABLE IF NOT EXISTS certificates (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      issue_date TIMESTAMPTZ DEFAULT NOW(), expiration_date TIMESTAMPTZ, 
      certificate_url TEXT, unique_code TEXT NOT NULL UNIQUE,
      UNIQUE(user_id, course_id) 
    );`;

  const quizzesTable = `
    CREATE TABLE IF NOT EXISTS quizzes (
      id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL, passing_score INTEGER NOT NULL DEFAULT 70,
      UNIQUE(course_id)
    );`;

  const questionsTable = `
    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY, quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL, question_order INTEGER
    );`;

  const optionsTable = `
    CREATE TABLE IF NOT EXISTS options (
      id SERIAL PRIMARY KEY, question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL, is_correct BOOLEAN NOT NULL DEFAULT FALSE
    );`;

  const quizAttemptsTable = `
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      score INTEGER NOT NULL, passed BOOLEAN NOT NULL,
      attempted_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  const eventsTable = `
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      start_date TIMESTAMPTZ NOT NULL, end_date TIMESTAMPTZ NOT NULL,
      category TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
      color TEXT DEFAULT '#daa520',
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
    );`;

  const enneagramQuestionsTable = `
    CREATE TABLE IF NOT EXISTS enneagram_questions (
      id SERIAL PRIMARY KEY, statement_a TEXT NOT NULL,
      type_a INTEGER NOT NULL, statement_b TEXT NOT NULL,
      type_b INTEGER NOT NULL
    );`;

  const userEnneagramResultsTable = `
    CREATE TABLE IF NOT EXISTS user_enneagram_results (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      dominant_type INTEGER NOT NULL, score_1 INTEGER NOT NULL DEFAULT 0,
      score_2 INTEGER NOT NULL DEFAULT 0, score_3 INTEGER NOT NULL DEFAULT 0,
      score_4 INTEGER NOT NULL DEFAULT 0, score_5 INTEGER NOT NULL DEFAULT 0,
      score_6 INTEGER NOT NULL DEFAULT 0, score_7 INTEGER NOT NULL DEFAULT 0,
      score_8 INTEGER NOT NULL DEFAULT 0, score_9 INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  const enneagramTypesTable = `
    CREATE TABLE IF NOT EXISTS enneagram_types (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
      work_description TEXT, personal_description TEXT
    );`;

  const eventNotificationsTable = `
    CREATE TABLE IF NOT EXISTS event_notifications (
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (event_id, user_id)
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
    await pool.query(quizzesTable);
    await pool.query(questionsTable);
    await pool.query(optionsTable);
    await pool.query(quizAttemptsTable);
    await pool.query(eventsTable);
    await pool.query(enneagramQuestionsTable);
    await pool.query(userEnneagramResultsTable);
    await pool.query(enneagramTypesTable);
    await pool.query(eventNotificationsTable);

    console.log("Tabelas verificadas/criadas com sucesso no PostgreSQL.");
  } catch (err) {
    console.error("Erro ao criar tabelas:", err);
  }
};

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
  createTables();
});
