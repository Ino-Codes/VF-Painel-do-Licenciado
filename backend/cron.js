const { Pool } = require("pg");

let pool; // Será inicializado depois
let resend;

const initializeCron = (dbPool, resendInstance) => {
  pool = dbPool;
  resend = resendInstance;
};

// Envio de email de eventos do dia (Com envio em Lotes / Rate Limiting)
const sendEventNotifications = async (resend) => {
  if (!pool)
    return console.error(
      "SEND NOTIFICATIONS: Pool de conexão não inicializado.",
    );
  console.log("SEND NOTIFICATIONS: Verificando eventos para hoje...");
  const now = new Date();
  const spDate = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );

  // Como as datas no banco podem estar em fuso diferente, vamos ajustar a query para pegar tudo do dia atual no fuso de SP
  const todayStart = new Date(
    spDate.getFullYear(),
    spDate.getMonth(),
    spDate.getDate(),
    0,
    0,
    0,
  );
  const todayEnd = new Date(
    spDate.getFullYear(),
    spDate.getMonth(),
    spDate.getDate(),
    23,
    59,
    59,
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
      [todayStart, todayEnd],
    );

    if (queryResult.rows.length === 0) {
      console.log(
        "SEND NOTIFICATIONS: Nenhum evento com notificados para hoje.",
      );
      return;
    }

    // Agrupa os eventos por usuário
    const notificationsByUser = queryResult.rows.reduce((acc, row) => {
      const { user_id, nome, email, ...event } = row;
      if (!acc[user_id]) {
        acc[user_id] = { nome, email, events: [] };
      }
      acc[user_id].events.push(event);
      return acc;
    }, {});

    // Transforma o objeto agrupado em um array para facilitar o uso do .map e .slice nos lotes
    const usersToNotify = Object.values(notificationsByUser).filter(
      (u) => u.email,
    );

    if (usersToNotify.length === 0) {
      console.log(
        "SEND NOTIFICATIONS: Eventos encontrados, mas nenhum usuário possui e-mail cadastrado.",
      );
      return;
    }

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const batchSize = 3; // Envia 3 emails por vez

    console.log(
      `SEND NOTIFICATIONS: Iniciando envio para ${usersToNotify.length} usuário(s) em lotes de ${batchSize}...`,
    );

    for (let i = 0; i < usersToNotify.length; i += batchSize) {
      const batch = usersToNotify.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (user) => {
          const eventsHtmlList = user.events
            .map((event) => {
              const eventTime = new Date(event.start_date).toLocaleTimeString(
                "pt-BR",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Sao_Paulo",
                },
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
                                <img src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1782936553/textobranco_zxw32o.png" alt="V-CORP Logo" style="width: 200px; height: auto;">
                              </td>
                            </tr>

                            <tr>
                              <td style="padding: 30px 40px; color: #2D2C2B; font-size: 16px; line-height: 1.6;">
                                <h2 style="font-size: 22px; color: #0D0D0D; margin-top: 0;">Lembrete de Eventos para Hoje</h2>
                                <p>Olá, ${user.nome.split(" ")[0]}!</p>
                                <p>Estes são os seus eventos agendados para hoje no Painel da V-CORP:</p>
                                <hr style="border: 0; border-top: 1px solid #e9ecef; margin: 20px 0;">
                                ${eventsHtmlList}
                                <hr style="border: 0; border-top: 1px solid #e9ecef; margin: 20px 0;">
                                <p style="text-align: center;">Acesse o painel para mais detalhes.</p>
                              </td>
                            </tr>

                            <tr>
                              <td align="center" style="background-color: #f8f9fa; padding: 20px; font-size: 12px; color: #6c757d;">
                                <p>V-CORP © ${new Date().getFullYear()}</p>
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

          try {
            await resend.emails.send({
              from: `Painel V-CORP <${process.env.EMAIL_FROM}>`,
              to: user.email,
              subject: `Lembrete: Você tem ${user.events.length} evento(s) hoje no Painel VF!`,
              html: html,
            });
            console.log(
              `SEND NOTIFICATIONS: Email enviado para ${user.email} com ${user.events.length} evento(s).`,
            );
          } catch (emailErr) {
            console.error(
              `SEND NOTIFICATIONS: Erro ao enviar email para ${user.email}:`,
              emailErr,
            );
          }
        }),
      );

      // Aguarda 1 segundo antes de disparar o próximo lote
      if (i + batchSize < usersToNotify.length) {
        await delay(1000);
      }
    }

    console.log(
      "SEND NOTIFICATIONS: Todos os envios diários de eventos concluídos com sucesso.",
    );
  } catch (err) {
    console.error(
      "SEND NOTIFICATIONS: Erro geral ao processar notificações de evento:",
      err,
    );
    throw err;
  }
};

module.exports = {
  initializeCron,
  sendEventNotifications,
};
