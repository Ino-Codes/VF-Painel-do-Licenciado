require("dotenv").config();

const migrationRunner = require("./migrationRunner.js");
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

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Regra: NÃO usar cors() globalmente.
// Cada grupo de rotas recebe seu próprio middleware de CORS.

const allowedOrigins = [
  "https://painel.vcorporate.com.br",
  "https://vf-painel-do-licenciado.onrender.com",
  "http://localhost:3000",
];

// Middleware CORS restrito — usado nas rotas protegidas
const corsRestrito = cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Não permitido pelo CORS"));
    }
  },
  optionsSuccessStatus: 200,
});

// Middleware CORS aberto — usado nas rotas públicas do widget e do
// acompanhamento de chamados (GET/POST, com ou sem Authorization).
const corsAberto = cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// ─── MIDDLEWARES GLOBAIS ───────────────────────────────────────────────────────
// Nenhum cors() aqui — cada rota aplica o seu próprio

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use((req, res, next) => {
  req.ipAddress =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  next();
});

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────

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
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
});

// ─── FUNÇÕES AUXILIARES ───────────────────────────────────────────────────────

const logActivity = async (userId, userEmail, action, details, ipAddress) => {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, user_email, action, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, userEmail, action, details, ipAddress],
    );
  } catch (err) {
    console.error("Falha ao registrar log de atividade:", err);
  }
};

const createNotification = async (userId, message, linkTo) => {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, message, link_to)
       VALUES ($1, $2, $3)`,
      [userId, message, linkTo || null],
    );
  } catch (err) {
    console.error(`Falha ao criar notificação para user_id ${userId}:`, err);
  }
};

// ─── IMPORTAÇÃO DAS ROTAS ─────────────────────────────────────────────────────

const cronFunctions = require("./cron.js");
const authRoutes = require("./routes/auth.js")(pool, resend, logActivity);
const userRoutes = require("./routes/users.js")(
  pool,
  cloudinary,
  upload,
  logActivity,
);
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
const socialRoutes = require("./routes/social.js")(pool, cloudinary, upload);
const projectRoutes = require("./routes/projects.js")(pool, logActivity);
const widgetTenantsRoutes = require("./routes/widgetTenants.js")(
  pool,
  logActivity,
);
const ticketsRoutes = require("./routes/tickets.js")(pool, logActivity, resend);
const meetingRecordsRoutes = require("./routes/meetingRecords.js")(
  pool,
  cloudinary,
  upload,
  resend,
  logActivity,
);
const archivesRoutes = require("./routes/archives.js")(
  pool,
  cloudinary,
  upload,
  logActivity,
);

cronFunctions.initializeCron(pool, resend);

// ─── REGISTRO DAS ROTAS ───────────────────────────────────────────────────────
// Cada rota recebe corsRestrito como middleware explícito.
// A rota pública do widget recebe corsAberto.

app.use("/api/auth", corsRestrito, authRoutes);
app.use("/api/users", corsRestrito, userRoutes);
app.use("/api/notices", corsRestrito, noticeRoutes);
app.use("/api/files", corsRestrito, filesRoutes);
app.use("/api/social", corsRestrito, socialRoutes);
app.use("/api/videos", corsRestrito, videoRoutes);
app.use("/api/faq", corsRestrito, faqRoutes);
app.use("/api/admin/logs", corsRestrito, logRoutes);
app.use("/api/admin/courses", corsRestrito, courseRoutes);
app.use("/api/certificates", corsRestrito, certificatesRoutes);
app.use("/api/quizzes", corsRestrito, quizzesRoutes);
app.use("/api/admin/events", corsRestrito, eventRoutes);
app.use("/api/events", corsRestrito, eventRoutes);
app.use("/api/enneagram", corsRestrito, enneagramRoutes);
app.use("/api/admin/analytics", corsRestrito, adminAnalyticsRoutes);
app.use("/api/cron", corsRestrito, cronTriggerRoutes);
app.use("/api/vacations", corsRestrito, vacationRoutes);
app.use("/api/notifications", corsRestrito, notificationRoutes);
app.use("/api/recruitment", corsRestrito, recruitmentRoutes);
app.use("/api/units", corsRestrito, unitsRoutes);
app.use("/api/projects", corsRestrito, projectRoutes);
app.use("/api/widget-tenants", corsRestrito, widgetTenantsRoutes);
app.use("/api/tickets", corsRestrito, ticketsRoutes);
app.use("/api/meeting-records", corsRestrito, meetingRecordsRoutes);
app.use("/api/archives", corsRestrito, archivesRoutes);

// ── Rota pública do widget — CORS aberto, sem autenticação ────────────────────
app.use("/api/ticket", corsAberto, ticketsRoutes);

// ─── INICIALIZAÇÃO DO SERVIDOR ────────────────────────────────────────────────

app.listen(port, async () => {
  console.log(`Servidor rodando na porta ${port}`);
  try {
    await migrationRunner(pool);
  } catch (err) {
    console.error("[migrations] Falha crítica:", err.message);
  }
});
