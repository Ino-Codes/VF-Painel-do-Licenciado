// backend/cron.js
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
    // 1. Consulta ÚNICA e mais eficiente para buscar todos os eventos e seus notificados de uma só vez
    const queryResult = await pool.query(
      `SELECT 
                e.title, e.description, e.start_date,
                u.id as user_id, u.nome, u.email
             FROM events e
             JOIN event_notifications en ON e.id = en.event_id
             JOIN users u ON en.user_id = u.id
             WHERE e.start_date >= $1 AND e.start_date <= $2
             ORDER BY u.id, e.start_date`,
      [todayStart, todayEnd]
    );

    if (queryResult.rows.length === 0) {
      console.log(
        "CRON JOB: Nenhum evento com notificados para hoje. Encerrando."
      );
      return;
    }

    // 2. Agrupa todos os eventos por usuário
    const notificationsByUser = queryResult.rows.reduce((acc, row) => {
      const { user_id, nome, email, ...event } = row;
      if (!acc[user_id]) {
        acc[user_id] = { nome, email, events: [] };
      }
      acc[user_id].events.push(event);
      return acc;
    }, {});

    // 3. Itera sobre cada USUÁRIO e envia um único email de resumo
    for (const userId in notificationsByUser) {
      const user = notificationsByUser[userId];

      // Monta uma lista HTML com os eventos do usuário
      const eventsHtmlList = user.events
        .map((event) => {
          const eventTime = new Date(event.start_date).toLocaleTimeString(
            "pt-BR",
            { hour: "2-digit", minute: "2-digit" }
          );
          return `
                    <li>
                        <strong>${event.title} às ${eventTime}</strong><br>
                        <em>${event.description || "Nenhuma descrição."}</em>
                    </li>`;
        })
        .join("");

      const msg = {
        to: user.email,
        from: process.env.EMAIL_FROM,
        subject: `Lembrete: Você tem ${user.events.length} evento(s) hoje!`,
        html: `
                    <p>Olá, ${user.nome}!</p>
                    <p>Estes são os seus eventos agendados para hoje:</p>
                    <ul>
                        ${eventsHtmlList}
                    </ul>
                    <br>
                    <p>Atenciosamente,<br>Painel Valor Fiscal</p>
                `,
      };

      await sgMail.send(msg);
      console.log(
        `CRON JOB: Email de resumo enviado para ${user.email} com ${user.events.length} evento(s).`
      );
    }
  } catch (err) {
    console.error("CRON JOB: Erro ao enviar notificações de evento:", err);
  }
};

const initScheduledJobs = () => {
  cron.schedule("00 16 * * *", sendEventNotifications, {
    timezone: "America/Sao_Paulo",
  });
  console.log(
    "Agendador de tarefas (Cron Job) para notificações de eventos foi iniciado para as 15:30."
  );
};

module.exports = { initScheduledJobs, sendEventNotifications };
