const cron = require("node-cron");
const { Pool } = require("pg");
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sendEventNotifications = async () => {
  console.log("CRON JOB: Verificando eventos para hoje...");
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0
  );
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  );

  try {
    const eventsResult = await pool.query(
      "SELECT * FROM events WHERE start_date >= $1 AND start_date <= $2",
      [todayStart, todayEnd]
    );

    if (eventsResult.rows.length === 0) {
      console.log("CRON JOB: Nenhum evento para hoje. Encerrando.");
      return;
    }

    for (const event of eventsResult.rows) {
      const usersResult = await pool.query(
        `SELECT u.email, u.nome FROM users u 
                 JOIN event_notifications en ON u.id = en.user_id 
                 WHERE en.event_id = $1`,
        [event.id]
      );

      if (usersResult.rows.length > 0) {
        const eventTime = new Date(event.start_date).toLocaleTimeString(
          "pt-BR",
          { hour: "2-digit", minute: "2-digit" }
        );
        const emails = usersResult.rows.map((u) => u.email);

        const msg = {
          to: emails,
          from: process.env.EMAIL_FROM,
          subject: `Lembrete de Evento: ${event.title}`,
          html: `
                        <p>Olá!</p>
                        <p>Este é um lembrete do evento que acontecerá hoje:</p>
                        <p><strong>Evento:</strong> ${event.title}</p>
                        <p><strong>Horário:</strong> ${eventTime}</p>
                        <p><strong>Descrição:</strong> ${
                          event.description || "Nenhuma descrição."
                        }</p>
                        <br>
                        <p>Atenciosamente,<br>Painel Valor Fiscal</p>
                    `,
        };
        await sgMail.send(msg);
        console.log(
          `CRON JOB: E-mail enviado para ${emails.length} usuário(s) sobre o evento "${event.title}".`
        );
      }
    }
  } catch (err) {
    console.error("CRON JOB: Erro ao enviar notificações de evento:", err);
  }
};

const initScheduledJobs = () => {
  cron.schedule("0 8 * * *", sendEventNotifications, {
    timezone: "America/Sao_Paulo",
  });
  console.log(
    "Agendador de tarefas (Cron Job) para notificações de eventos foi iniciado."
  );
};

module.exports = { initScheduledJobs };
