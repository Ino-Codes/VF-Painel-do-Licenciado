//require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const { Pool } = require("pg");
const cloudinary = require("cloudinary").v2;
const cron = require("node-cron");
const { Resend } = require("resend");

const app = express();

const port = process.env.PORT || 3001;

// --- CONFIGURAÇÕES ---
const allowedOrigins = [
  "https://painel.valorfiscal.com",
  "http://localhost:3000",
  "https://vf-painel-do-licenciado.onrender.com",
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

const resend = new Resend(process.env.RESEND_API_KEY);

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

const createNotification = async (userId, message, linkTo) => {
  try {
    const sql = `INSERT INTO notifications (user_id, message, link_to) VALUES ($1, $2, $3)`;
    await pool.query(sql, [userId, message, linkTo || null]);
  } catch (err) {
    console.error(`Falha ao criar notificação para user_id ${userId}:`, err);
  }
};

// --- IMPORTAÇÃO DAS ROTAS ---
const authRoutes = require("./routes/auth.js")(pool, resend, logActivity);
const userRoutes = require("./routes/users.js")(
  pool,
  cloudinary,
  upload,
  logActivity,
);
const cronFunctions = require("./cron.js");
cronFunctions.initializeCron(pool, resend);
const noticeRoutes = require("./routes/notices.js")(
  pool,
  createNotification,
  logActivity,
  resend,
);
const filesRoutes = require("./routes/files")(
  pool,
  cloudinary,
  upload,
  logActivity,
);

const videoRoutes = require("./routes/videos.js")(pool);
const faqRoutes = require("./routes/faq.js")(pool, cloudinary, upload);
const logRoutes = require("./routes/logs.js")(pool);
const courseRoutes = require("./routes/courses.js")(pool, cloudinary, upload);
const certificatesRoutes = require("./routes/certificates.js")(pool);
const quizzesRoutes = require("./routes/quizzes.js")(pool);
const eventRoutes = require("./routes/events.js")(pool);
const enneagramRoutes = require("./routes/enneagram.js")(pool);
const adminAnalyticsRoutes = require("./routes/adminAnalytics.js")(
  pool,
  resend,
);
const cronTriggerRoutes = require("./routes/cronTrigger.js")(pool);
const vacationRoutes = require("./routes/vacations.js")(
  pool,
  createNotification,
);
const notificationRoutes = require("./routes/notifications.js")(pool);
const recruitmentRoutes = require("./routes/recruitment.js")(pool, logActivity);
const unitsRoutes = require("./routes/units.js")(pool);
const socialPostsTable = require("./routes/social.js")(
  pool,
  cloudinary,
  upload,
);

// --- USO DAS ROTAS ---
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/social", socialPostsTable);
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
app.use("/api/vacations", vacationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/recruitment", recruitmentRoutes);
app.use("/api/units", unitsRoutes);

// --- CRIAÇÃO DAS TABELAS ---

const createTables = async () => {
  const userTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      nome TEXT,
      avatar_url TEXT,
      reset_token TEXT,
      reset_token_expires TIMESTAMPTZ,
      birth_date DATE,
      cargo TEXT,
      setor TEXT,
      must_change_password BOOLEAN DEFAULT TRUE,
      unidade TEXT,
      telefone TEXT,
      data_admissao DATE,
      saldo_ferias INTEGER NOT NULL DEFAULT 0,
      corporate_photo_url TEXT
    );`;

  const noticeTable = `
    CREATE TABLE IF NOT EXISTS notices (
      id SERIAL PRIMARY KEY,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      visibility TEXT NOT NULL DEFAULT 'todos'
    );`;

  const fileTable = `
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      filename TEXT,
      originalname TEXT,
      category TEXT,
      folder TEXT,
      public_id TEXT,
      visibility TEXT DEFAULT 'public',
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  const videoTable = `
    CREATE TABLE IF NOT EXISTS videos (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      youtube_url TEXT NOT NULL,
      visibility TEXT DEFAULT 'public',
      category TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  const logsTable = `
    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_email TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  const faqTable = `
    CREATE TABLE IF NOT EXISTS faq (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      document_url TEXT,
      document_originalname TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      visibility TEXT NOT NULL DEFAULT 'todos'
    );`;

  const coursesTable = `
    CREATE TABLE IF NOT EXISTS courses (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      thumbnail_url TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      certificate_template_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      visibility TEXT NOT NULL DEFAULT 'todos'
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
      video_url TEXT,
      text_content TEXT,
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
      issue_date TIMESTAMPTZ DEFAULT NOW(),
      expiration_date TIMESTAMPTZ,
      certificate_url TEXT,
      unique_code TEXT NOT NULL UNIQUE,
      UNIQUE(user_id, course_id)
    );`;

  const quizzesTable = `
    CREATE TABLE IF NOT EXISTS quizzes (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      passing_score INTEGER NOT NULL DEFAULT 70,
      UNIQUE(course_id)
    );`;

  const questionsTable = `
    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      question_order INTEGER
    );`;

  const optionsTable = `
    CREATE TABLE IF NOT EXISTS options (
      id SERIAL PRIMARY KEY,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL DEFAULT FALSE
    );`;

  const quizAttemptsTable = `
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      passed BOOLEAN NOT NULL,
      attempted_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  const eventsTable = `
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ NOT NULL,
      category TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      color TEXT DEFAULT '#daa520',
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
    );`;

  const eventNotificationsTable = `
    CREATE TABLE IF NOT EXISTS event_notifications (
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (event_id, user_id)
    );`;

  const enneagramQuestionsTable = `
    CREATE TABLE IF NOT EXISTS enneagram_questions (
      id SERIAL PRIMARY KEY,
      statement_a TEXT NOT NULL,
      type_a INTEGER NOT NULL,
      statement_b TEXT NOT NULL,
      type_b INTEGER NOT NULL
    );`;

  const userEnneagramResultsTable = `
    CREATE TABLE IF NOT EXISTS user_enneagram_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      dominant_type INTEGER NOT NULL,
      score_1 INTEGER NOT NULL DEFAULT 0,
      score_2 INTEGER NOT NULL DEFAULT 0,
      score_3 INTEGER NOT NULL DEFAULT 0,
      score_4 INTEGER NOT NULL DEFAULT 0,
      score_5 INTEGER NOT NULL DEFAULT 0,
      score_6 INTEGER NOT NULL DEFAULT 0,
      score_7 INTEGER NOT NULL DEFAULT 0,
      score_8 INTEGER NOT NULL DEFAULT 0,
      score_9 INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  const enneagramTypesTable = `
    CREATE TABLE IF NOT EXISTS enneagram_types (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      work_description TEXT,
      personal_description TEXT
    );`;

  const vacationRequestsTable = `
    CREATE TABLE IF NOT EXISTS vacation_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        dias_solicitados INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pendente',
        requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        approver_id INTEGER REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        observacao TEXT
    );`;

  const notificationsTable = `
    CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        link_to TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );`;

  const recruitmentStagesTable = `
    CREATE TABLE IF NOT EXISTS recruitment_stages (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        stage_order INTEGER NOT NULL,
        pipeline_type TEXT NOT NULL DEFAULT 'Recrutamento'
    );`;

  const unitsTable = `
    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  const candidatesTable = `
  CREATE TABLE IF NOT EXISTS candidates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role_applied_for TEXT,
      status TEXT NOT NULL DEFAULT 'Ativo',
    stage_id INTEGER NOT NULL REFERENCES recruitment_stages(id),
    unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_approved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );`;
  const candidateTasksTable = `
  CREATE TABLE IF NOT EXISTS candidate_tasks (
      id SERIAL PRIMARY KEY,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      task_name TEXT NOT NULL,
      is_completed BOOLEAN NOT NULL DEFAULT FALSE,
      responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, 
      due_date DATE
  );`;

  const checklistTemplatesTable = `
      CREATE TABLE IF NOT EXISTS checklist_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

  const checklistTemplateItemsTable = `
      CREATE TABLE IF NOT EXISTS checklist_template_items (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
        task_name TEXT NOT NULL,
        due_days INTEGER DEFAULT NULL
      );
    `;

  const socialPostsTable = `
    CREATE TABLE IF NOT EXISTS social_posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      caption TEXT,
      images TEXT[] NOT NULL,
      visibility TEXT DEFAULT 'public',
      company_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id)
    );`;

  const recruitmentInterviewsTable = `
    CREATE TABLE IF NOT EXISTS recruitment_interviews (
      id SERIAL PRIMARY KEY,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      interviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      stage_id INTEGER REFERENCES recruitment_stages(id) ON DELETE SET NULL,
      title TEXT,
      description TEXT,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ,
      is_virtual BOOLEAN DEFAULT FALSE,
      meeting_link TEXT,
      location TEXT,
      status TEXT DEFAULT 'scheduled',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
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
    await pool.query(vacationRequestsTable);
    await pool.query(notificationsTable);
    await pool.query(unitsTable);
    await pool.query(socialPostsTable);

    // ensure users has unidade_id column to link to units (backwards-compatible)
    await pool.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS unidade_id INTEGER;",
    );
    await pool.query(
      "INSERT INTO units (name) SELECT 'Matriz' WHERE NOT EXISTS (SELECT 1 FROM units WHERE name='Matriz')",
    );
    await pool.query(
      "INSERT INTO units (name) SELECT 'Filial SC' WHERE NOT EXISTS (SELECT 1 FROM units WHERE name='Filial SC')",
    );
    await pool.query(
      "INSERT INTO units (name) SELECT 'Filial SP' WHERE NOT EXISTS (SELECT 1 FROM units WHERE name='Filial SP')",
    );
    await pool.query(recruitmentStagesTable);
    // Seed an "Entrevista" stage used for scheduled interviews (pre-kanban)
    await pool.query(
      "INSERT INTO recruitment_stages (name, stage_order, pipeline_type) SELECT 'Entrevista', 0, 'Recrutamento' WHERE NOT EXISTS (SELECT 1 FROM recruitment_stages WHERE name ILIKE 'entrevista')",
    );
    await pool.query(
      "ALTER TABLE social_posts DROP COLUMN IF EXISTS company_name;",
    );
    await pool.query(
      "ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS company_id INTEGER;",
    );
    await pool.query(
      "ALTER TABLE notices ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;",
    );
    await pool.query(
      "ALTER TABLE notices ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;",
    );

    await pool.query(recruitmentInterviewsTable);
    // Ensure candidates table has unit_id column for new linkage
    await pool.query(
      "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS unit_id INTEGER;",
    );
    await pool.query(candidatesTable);
    await pool.query(candidateTasksTable);
    await pool.query(checklistTemplatesTable);
    await pool.query(checklistTemplateItemsTable);
    // seed a default checklist template if not exists
    await pool.query(
      "INSERT INTO checklist_templates (name, is_default) SELECT 'Template Padrão' , true WHERE NOT EXISTS (SELECT 1 FROM checklist_templates WHERE is_default = true)",
    );
    // seed some template items if template exists and items empty
    await pool.query(
      `INSERT INTO checklist_template_items (template_id, task_name)
         SELECT t.id, v.task FROM (SELECT id FROM checklist_templates WHERE is_default = true LIMIT 1) t
         CROSS JOIN (VALUES ('Contato inicial'), ('Enviar teste técnico'), ('Agendar entrevista')) v(task)
         WHERE NOT EXISTS (SELECT 1 FROM checklist_template_items it JOIN checklist_templates tt ON it.template_id = tt.id WHERE tt.is_default = true)
        `,
    );

    console.log("Tabelas verificadas/criadas com sucesso no PostgreSQL.");
  } catch (err) {
    console.error("Erro ao criar tabelas:", err);
  }
};

cron.schedule(
  "*/60 * * * *", // Roda a cada 60 minutos
  () => {
    console.log("CRON: Executando a tarefa agendada updateVacationBalance...");
    cronFunctions.updateVacationBalance();
  },
  {
    scheduled: true,
    timezone: "America/Sao_Paulo",
  },
);

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
  createTables();
});
