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
    const queryResult = await pool.query(
      `SELECT 
                e.title, e.description, e.start_date, e.color,
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

    const notificationsByUser = queryResult.rows.reduce((acc, row) => {
      const { user_id, nome, email, ...event } = row;
      if (!acc[user_id]) {
        acc[user_id] = { nome, email, events: [] };
      }
      acc[user_id].events.push(event);
      return acc;
    }, {});

    for (const userId in notificationsByUser) {
      const user = notificationsByUser[userId];

      const eventsHtmlList = user.events
        .map((event) => {
          const eventTime = new Date(event.start_date).toLocaleTimeString(
            "pt-BR",
            {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            }
          );
          const eventColor = event.color || "#daa520";
          return `
                    <div style="background-color: #ffffff; border: 1px solid #e9ecef; border-left: 5px solid ${eventColor}; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #0D0D0D;">${
                          event.title
                        } às ${eventTime}</p>
                        <p style="margin: 5px 0 0; font-size: 14px; color: #6c757d;">${
                          event.description || ""
                        }</p>
                    </div>
                `;
        })
        .join("");

      const html = `
              <!DOCTYPE html>
              <html lang="pt-BR">
              <head>
                <style>
                  body { font-family: 'Montserrat', sans-serif; }
                </style>
              </head>
              <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding: 20px 0;">
                      <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        
                        <tr>
                          <td align="center" style="background-color: #111217; padding: 20px 0;">
                            <img src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1754399924/logo-clara_guvics.png" alt="Valor Fiscal Logo" style="width: 200px; height: auto;">
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 30px 40px; color: #2D2C2B; font-size: 16px; line-height: 1.6;">
                            <h2 style="font-size: 22px; color: #0D0D0D; margin-top: 0;">Lembrete de Eventos para Hoje</h2>
                            <p>Olá, ${user.nome}!</p>
                            <p>Estes são os seus eventos agendados para hoje no Painel da Valor Fiscal:</p>
                            <hr style="border: 0; border-top: 1px solid #e9ecef; margin: 20px 0;">
                            ${eventsHtmlList}
                            <hr style="border: 0; border-top: 1px solid #e9ecef; margin: 20px 0;">
                            <p style="text-align: center;">Acesse o painel para mais detalhes.</p>
                          </td>
                        </tr>

                        <tr>
                          <td align="center" style="background-color: #f8f9fa; padding: 20px; font-size: 12px; color: #6c757d;">
                            <p>Valor Fiscal Inteligência Tributária © ${new Date().getFullYear()}</p>
                            <p>Esta é uma mensagem automática. Por favor, não responda a este email.</p>
                          </td>
                        </tr>

                      </table>
                    </td>
                  </tr>
                </table>
              </body>
              </html>
            `;

      const msg = {
        to: user.email,
        from: process.env.EMAIL_FROM,
        subject: `Lembrete: Você tem ${user.events.length} evento(s) hoje no Painel VF!`,
        html: html,
      };

      await sgMail.send(msg);
      console.log(
        `CRON JOB: Email de resumo estilizado enviado para ${user.email} com ${user.events.length} evento(s).`
      );
    }
  } catch (err) {
    console.error("CRON JOB: Erro ao enviar notificações de evento:", err);
  }
};

const initScheduledJobs = () => {
  cron.schedule("12 16 * * *", sendEventNotifications, {
    timezone: "America/Sao_Paulo",
  });
  console.log(
    "Agendador de tarefas (Cron Job) para notificações de eventos foi iniciado para as 15:30."
  );
};

module.exports = { initScheduledJobs, sendEventNotifications };
