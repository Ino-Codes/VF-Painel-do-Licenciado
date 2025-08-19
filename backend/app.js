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
app.use("/api/admin/courses", courseRoutes(pool, cloudinary, upload));

// --- INICIALIZAÇÃO DO SERVIDOR E BANCO ---
// --- INICIALIZAÇÃO DO SERVIDOR E BANCO ---
const createTables = async () => {
  // Comando para excluir a tabela 'lessons' e suas dependências
  const dropLessonsTable = `DROP TABLE IF EXISTS lessons CASCADE;`;

  // Definições das outras tabelas (sem a 'lessonsTable')
  const userTable = `...`; // Mantenha seu código aqui
  const noticeTable = `...`; // Mantenha seu código aqui
  const fileTable = `...`; // Mantenha seu código aqui
  const videoTable = `...`; // Mantenha seu código aqui
  const logsTable = `...`; // Mantenha seu código aqui
  const faqTable = `...`; // Mantenha seu código aqui
  const coursesTable = `...`; // Mantenha seu código aqui
  const modulesTable = `...`; // Mantenha seu código aqui
  // A lessonsTable foi removida daqui por enquanto
  const userCoursesTable = `...`; // Mantenha seu código aqui
  const progressTable = `...`; // Mantenha seu código aqui
  const certificatesTable = `...`; // Mantenha seu código aqui

  try {
    // Executa o comando para apagar a tabela primeiro
    await pool.query(dropLessonsTable);
    console.log("Tabela 'lessons' antiga excluída com sucesso (se existia).");

    // Recria as outras tabelas
    await pool.query(userTable);
    await pool.query(noticeTable);
    await pool.query(fileTable);
    await pool.query(videoTable);
    await pool.query(logsTable);
    await pool.query(faqTable);
    await pool.query(coursesTable);
    await pool.query(modulesTable);
    await pool.query(userCoursesTable);
    await pool.query(progressTable);
    await pool.query(certificatesTable);

    console.log("Tabelas (exceto lessons) verificadas/criadas com sucesso.");
  } catch (err) {
    console.error("Erro ao modificar tabelas:", err);
  }
};

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  createTables();
});
