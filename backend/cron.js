const { Pool } = require("pg");

let pool; // Será inicializado depois
let resend;

const initializeCron = (dbPool, resendInstance) => {
  pool = dbPool;
  resend = resendInstance;
};

// Evento periódico de cálculo do saldo de férias de cada colaborador
const updateVacationBalance = async () => {
  if (!pool) return console.error("CRON: Pool de conexão não inicializado.");
  console.log("CRON: Iniciando verificação de aniversário de admissão...");
  const client = await pool.connect();
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // Mês atual (1-12)
    const currentDay = today.getDate(); // Dia atual

    // Seleciona utilizadores (não licenciados) que fazem aniversário de admissão HOJE
    // e que foram admitidos há pelo menos 11 meses (para garantir o primeiro ano)
    const query = `
      SELECT id, nome, data_admissao, saldo_ferias 
      FROM users 
      WHERE role != 'licenciado' 
        AND EXTRACT(MONTH FROM data_admissao) = $1 
        AND EXTRACT(DAY FROM data_admissao) = $2
        AND data_admissao <= NOW() - INTERVAL '11 months'; 
    `;

    const result = await client.query(query, [currentMonth, currentDay]);
    const usersToUpdate = result.rows;

    if (usersToUpdate.length === 0) {
      console.log("CRON: Nenhum colaborador completando ano de casa hoje.");
      return;
    }

    console.log(
      `CRON: Encontrados ${usersToUpdate.length} colaboradores para atualizar saldo de férias.`
    );

    await client.query("BEGIN");
    for (const user of usersToUpdate) {
      // Calcula quantos anos de casa completos
      const yearsSinceAdmission =
        today.getFullYear() - new Date(user.data_admissao).getFullYear();

      // Adiciona 30 dias ao saldo atual
      // IMPORTANTE: Esta lógica simples adiciona 30 dias a cada ano.
      // Ajustes podem ser necessários para regras mais complexas de saldo acumulado.
      const newBalance = (user.saldo_ferias || 0) + 30;

      await client.query("UPDATE users SET saldo_ferias = $1 WHERE id = $2", [
        newBalance,
        user.id,
      ]);
      console.log(
        `CRON: Saldo de férias atualizado para ${user.nome} (ID: ${user.id}). Novo saldo: ${newBalance}`
      );
    }
    await client.query("COMMIT");
    console.log("CRON: Atualização de saldos de férias concluída.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CRON: Erro ao atualizar saldo de férias:", err);
  } finally {
    client.release();
  }
};

// Envio de email de eventos do dia
const sendEventNotifications = async (resend) => {
  if (!pool)
    return console.error(
      "SEND NOTIFICATIONS: Pool de conexão não inicializado."
    );
  console.log("SEND NOTIFICATIONS: Verificando eventos para hoje...");
  const now = new Date();
  const spDate = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const todayStart = new Date(
    spDate.getFullYear(),
    spDate.getMonth(),
    spDate.getDate(),
    0,
    0,
    0
  );
  const todayEnd = new Date(
    spDate.getFullYear(),
    spDate.getMonth(),
    spDate.getDate(),
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
        "SEND NOTIFICATIONS: Nenhum evento com notificados para hoje."
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

      await resend.emails.send({
        from: `Painel Valor Fiscal <${process.env.EMAIL_FROM}>`,
        to: user.email, // Endereço do destinatário
        subject: `Lembrete: Você tem ${user.events.length} evento(s) hoje no Painel VF!`, // Assunto
        html: html, // Corpo do e-mail em HTML
      });

      console.log(
        `SEND NOTIFICATIONS: Email de resumo estilizado enviado para ${user.email} com ${user.events.length} evento(s).`
      );
    }
  } catch (err) {
    console.error(
      "SEND NOTIFICATIONS: Erro ao enviar notificações de evento:",
      err
    );
    throw err;
  }
};

// Apenas exportamos a função, sem agendamento
module.exports = {
  initializeCron,
  sendEventNotifications,
  updateVacationBalance,
};
