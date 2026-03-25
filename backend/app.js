//require("dotenv").config();

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

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────

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

// ─── MIDDLEWARES ──────────────────────────────────────────────────────────────

app.use(express.json());

app.use((req, res, next) => {
  req.ipAddress =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  next();
});

// ─── FUNÇÕES AUXILIARES ───────────────────────────────────────────────────────

const logActivity = async (userId, userEmail, action, details, ipAddress) => {
  try {
    const sql = `
      INSERT INTO activity_logs (user_id, user_email, action, details, ip_address)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await pool.query(sql, [userId, userEmail, action, details, ipAddress]);
  } catch (err) {
    console.error("Falha ao registrar log de atividade:", err);
  }
};

const createNotification = async (userId, message, linkTo) => {
  try {
    const sql = `
      INSERT INTO notifications (user_id, message, link_to)
      VALUES ($1, $2, $3)
    `;
    await pool.query(sql, [userId, message, linkTo || null]);
  } catch (err) {
    console.error(`Falha ao criar notificação para user_id ${userId}:`, err);
  }
};

// ─── IMPORTAÇÃO DAS ROTAS ─────────────────────────────────────────────────────

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
const socialRoutes = require("./routes/social.js")(pool, cloudinary, upload);

// ─── REGISTRO DAS ROTAS ───────────────────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/social", socialRoutes);
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

// ─── CRON JOBS ────────────────────────────────────────────────────────────────

cron.schedule(
  "*/60 * * * *",
  () => {
    console.log("CRON: Executando updateVacationBalance...");
    cronFunctions.updateVacationBalance();
  },
  {
    scheduled: true,
    timezone: "America/Sao_Paulo",
  },
);

// ─── INICIALIZAÇÃO DO SERVIDOR ────────────────────────────────────────────────

app.listen(port, async () => {
  console.log(`Servidor rodando na porta ${port}`);
  try {
    await migrationRunner(pool);
  } catch (err) {
    console.error(
      "[migrations] Falha crítica — servidor pode estar instável:",
      err.message,
    );
  }
});
