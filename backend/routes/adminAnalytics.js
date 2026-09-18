const express = require("express");
const router = express.Router();

const { isLoggedIn, checkPermission } = require("../middleware/auth.js");
const { sendEventNotifications } = require("../cron.js");

// Unificamos as funções aqui recebendo pool e resend
module.exports = function (pool, resend) {
  // --- ESTATÍSTICAS AO VIVO ---
  router.get(
    "/system-usage",
    isLoggedIn,
    checkPermission("analytics.view"),
    async (req, res) => {
      try {
        // 1. Logins hoje
        const todayLoginsQuery = pool.query(`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM activity_logs
        WHERE action = 'Login Bem-Sucedido'
          AND created_at::date = CURRENT_DATE
      `);

        // 2. Total de colaboradores cadastrados
        const totalUsersQuery = pool.query(`
        SELECT COUNT(*) as count FROM users WHERE role != 'licenciado'
      `);

        // 3. Total de licenciados cadastrados
        const totalLicenciadosQuery = pool.query(`
        SELECT COUNT(*) as count FROM users WHERE role = 'licenciado'
      `);

        // 4. Total de downloads de arquivos
        const totalDownloadsQuery = pool.query(`
        SELECT COUNT(*) as count FROM activity_logs WHERE action = 'DOWNLOAD_FILE'
      `);

        // 5. Top 5 arquivos mais baixados
        const topDownloadsQuery = pool.query(`
        SELECT 
          SUBSTRING(details FROM 'baixou o arquivo (.*)') as filename, 
          COUNT(*) as count 
        FROM activity_logs 
        WHERE action = 'DOWNLOAD_FILE' 
        GROUP BY filename
        ORDER BY count DESC 
        LIMIT 5
      `);

        const [
          todayLoginsRes,
          totalUsersRes,
          totalLicenciadosRes,
          totalDownloadsRes,
          topDownloadsRes,
        ] = await Promise.all([
          todayLoginsQuery,
          totalUsersQuery,
          totalLicenciadosQuery,
          totalDownloadsQuery,
          topDownloadsQuery,
        ]);

        const stats = {
          todayLogins: parseInt(todayLoginsRes.rows[0].count, 10),
          totalInternalUsers: parseInt(totalUsersRes.rows[0].count, 10),
          totalLicenciados: parseInt(totalLicenciadosRes.rows[0].count, 10),
          totalDownloads: parseInt(totalDownloadsRes.rows[0].count, 10),
          topDownloads: topDownloadsRes.rows.map((row) => ({
            name: row.filename || "Arquivo Desconhecido",
            count: parseInt(row.count, 10),
          })),
        };

        res.json(stats);
      } catch (err) {
        console.error("Erro ao buscar estatísticas de uso:", err);
        res.status(500).json({ error: "Erro ao buscar estatísticas." });
      }
    },
  );

  router.get(
    "/enneagram-stats",
    isLoggedIn,
    checkPermission("analytics.view"),
    async (req, res) => {
      try {
        const typeCountsQuery = pool.query(
          `SELECT dominant_type, COUNT(*) as count 
         FROM user_enneagram_results 
         GROUP BY dominant_type`,
        );

        const completedUsersQuery = pool.query(
          `SELECT u.nome, u.setor, r.dominant_type 
         FROM user_enneagram_results r 
         JOIN users u ON r.user_id = u.id 
         ORDER BY u.nome ASC`,
        );

        const totalCollaboratorsQuery = pool.query(
          "SELECT COUNT(*) as total FROM users WHERE role != 'licenciado'",
        );

        const completedCollaboratorsQuery = pool.query(
          `SELECT COUNT(*) as completed FROM user_enneagram_results r
         JOIN users u ON r.user_id = u.id
         WHERE u.role != 'licenciado'`,
        );

        const [
          typeCountsResult,
          completedUsersResult,
          totalCollaboratorsResult,
          completedCollaboratorsResult,
        ] = await Promise.all([
          typeCountsQuery,
          completedUsersQuery,
          totalCollaboratorsQuery,
          completedCollaboratorsQuery,
        ]);

        const response = {
          typeCounts: typeCountsResult.rows,
          completedUsers: completedUsersResult.rows,
          collaboratorStats: {
            total: parseInt(totalCollaboratorsResult.rows[0].total, 10),
            completed: parseInt(
              completedCollaboratorsResult.rows[0].completed,
              10,
            ),
          },
        };

        res.json(response);
      } catch (err) {
        console.error("Erro ao buscar estatísticas do Eneagrama:", err);
        res.status(500).json({ error: "Erro ao buscar estatísticas." });
      }
    },
  );

  router.get(
    "/trigger-email-test",
    isLoggedIn,
    checkPermission("analytics.view"),
    async (req, res) => {
      console.log(
        "ROTA DE TESTE: Disparando manualmente o envio de emails de eventos...",
      );
      try {
        await sendEventNotifications(resend);
        res
          .status(200)
          .send(
            "Tarefa de notificação de eventos executada manualmente com sucesso. Verifique os logs e a sua caixa de entrada.",
          );
      } catch (error) {
        console.error(
          "ROTA DE TESTE: Erro ao executar a tarefa manualmente.",
          error,
        );
        res.status(500).send("Ocorreu um erro ao executar a tarefa.");
      }
    },
  );

  router.get(
    "/course-engagement",
    isLoggedIn,
    checkPermission("analytics.view"),
    async (req, res) => {
      try {
        const query = `
      SELECT
        u.nome,
        u.avatar_url,
        COUNT(p.id)::int AS completed_lessons_count
      FROM
        progress p
      JOIN
        users u ON p.user_id = u.id
      WHERE
        u.role != 'licenciado' 
      GROUP BY
        u.id, u.nome, u.avatar_url
      ORDER BY
        completed_lessons_count DESC
      LIMIT 3;
    `;

        const result = await pool.query(query);
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao buscar engajamento de cursos:", err);
        res.status(500).json({ error: "Erro ao buscar dados de engajamento." });
      }
    },
  );

  // --- ESTATÍSTICAS DA CENTRAL DE CHAMADOS ---
  router.get(
    "/helpdesk",
    isLoggedIn,
    checkPermission("analytics.view"),
    async (req, res) => {
      try {
        const totalQuery = pool.query(
          "SELECT COUNT(*)::int AS c FROM tickets",
        );

        const byStatusQuery = pool.query(
          "SELECT status, COUNT(*)::int AS c FROM tickets GROUP BY status",
        );

        const byTypeQuery = pool.query(
          "SELECT type, COUNT(*)::int AS c FROM tickets GROUP BY type ORDER BY c DESC",
        );

        const bySystemQuery = pool.query(
          `SELECT COALESCE(wt.name, 'Sem sistema') AS name, COUNT(*)::int AS c
           FROM tickets t
           LEFT JOIN widget_tenants wt ON t.tenant_id = wt.id
           GROUP BY wt.name
           ORDER BY c DESC
           LIMIT 8`,
        );

        const openedQuery = pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS today,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS d7,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS d30
           FROM tickets`,
        );

        // Tempo médio de resolução: do 1º evento 'novo' ao 1º 'concluido'.
        const avgResolutionQuery = pool.query(
          `WITH opened AS (
             SELECT ticket_id, MIN(changed_at) AS t0
             FROM ticket_status_history WHERE to_status = 'novo' GROUP BY ticket_id
           ),
           closed AS (
             SELECT ticket_id, MIN(changed_at) AS t1
             FROM ticket_status_history WHERE to_status = 'concluido' GROUP BY ticket_id
           )
           SELECT AVG(EXTRACT(EPOCH FROM (c.t1 - o.t0)) / 3600.0) AS hours
           FROM opened o
           JOIN closed c ON c.ticket_id = o.ticket_id
           WHERE c.t1 >= o.t0`,
        );

        // ── Séries para os gráficos ──
        // Atenção aos fusos: `tickets.created_at` é timestamp SEM fuso
        // (gravado em UTC) e `ticket_status_history.changed_at` é COM fuso,
        // por isso a conversão difere entre os dois. Tudo é agrupado no fuso
        // de São Paulo — senão os chamados do fim da tarde caem no dia
        // seguinte e o mapa de horários fica 3 horas deslocado.
        const TZ = "America/Sao_Paulo";

        // Abertos x concluídos por dia (30 dias), sem buracos no eixo.
        const dailyQuery = pool.query(
          `WITH dias AS (
             SELECT generate_series(
               (NOW() AT TIME ZONE $1)::date - INTERVAL '29 days',
               (NOW() AT TIME ZONE $1)::date,
               INTERVAL '1 day'
             )::date AS dia
           ), abertos AS (
             SELECT (created_at AT TIME ZONE 'UTC' AT TIME ZONE $1)::date AS dia,
                    COUNT(*)::int AS c
             FROM tickets GROUP BY 1
           ), concluidos AS (
             SELECT dia, COUNT(*)::int AS c FROM (
               SELECT ticket_id, (MIN(changed_at) AT TIME ZONE $1)::date AS dia
               FROM ticket_status_history
               WHERE to_status = 'concluido'
               GROUP BY ticket_id
             ) x GROUP BY dia
           )
           SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
                  COALESCE(a.c, 0) AS abertos,
                  COALESCE(f.c, 0) AS concluidos
           FROM dias d
           LEFT JOIN abertos a ON a.dia = d.dia
           LEFT JOIN concluidos f ON f.dia = d.dia
           ORDER BY d.dia`,
          [TZ],
        );

        // Mapa de calor: dia da semana x faixa de 4 horas.
        const heatmapQuery = pool.query(
          `SELECT EXTRACT(DOW FROM local)::int AS dow,
                  FLOOR(EXTRACT(HOUR FROM local) / 4)::int AS bloco,
                  COUNT(*)::int AS c
             FROM (
               SELECT created_at AT TIME ZONE 'UTC' AT TIME ZONE $1 AS local
               FROM tickets
             ) t
            GROUP BY 1, 2`,
          [TZ],
        );

        // Tempo médio de resolução por mês (6 meses).
        const monthlyQuery = pool.query(
          `WITH opened AS (
             SELECT ticket_id, MIN(changed_at) AS t0
             FROM ticket_status_history WHERE to_status = 'novo' GROUP BY ticket_id
           ), closed AS (
             SELECT ticket_id, MIN(changed_at) AS t1
             FROM ticket_status_history WHERE to_status = 'concluido' GROUP BY ticket_id
           )
           SELECT to_char(date_trunc('month', (c.t1 AT TIME ZONE $1)), 'YYYY-MM') AS mes,
                  AVG(EXTRACT(EPOCH FROM (c.t1 - o.t0)) / 3600.0) AS horas,
                  COUNT(*)::int AS concluidos
             FROM opened o
             JOIN closed c ON c.ticket_id = o.ticket_id
            WHERE c.t1 >= o.t0
              AND c.t1 >= date_trunc('month', NOW()) - INTERVAL '5 months'
            GROUP BY 1, date_trunc('month', (c.t1 AT TIME ZONE $1))
            ORDER BY 1`,
          [TZ],
        );

        // Chamados concluídos por atendente.
        const byAttendantQuery = pool.query(
          `SELECT COALESCE(NULLIF(TRIM(attendant_name), ''), 'Sem atendente') AS name,
                  COUNT(*)::int AS c
             FROM tickets
            WHERE status = 'concluido'
            GROUP BY 1
            ORDER BY c DESC
            LIMIT 8`,
        );

        const [
          totalRes,
          byStatusRes,
          byTypeRes,
          bySystemRes,
          openedRes,
          avgRes,
          dailyRes,
          heatmapRes,
          monthlyRes,
          byAttendantRes,
        ] = await Promise.all([
          totalQuery,
          byStatusQuery,
          byTypeQuery,
          bySystemQuery,
          openedQuery,
          avgResolutionQuery,
          dailyQuery,
          heatmapQuery,
          monthlyQuery,
          byAttendantQuery,
        ]);

        const byStatus = {};
        byStatusRes.rows.forEach((r) => {
          byStatus[r.status] = r.c;
        });

        const avgHours = avgRes.rows[0].hours;

        res.json({
          total: totalRes.rows[0].c,
          byStatus,
          byType: byTypeRes.rows.map((r) => ({ type: r.type, count: r.c })),
          bySystem: bySystemRes.rows.map((r) => ({ name: r.name, count: r.c })),
          openedToday: openedRes.rows[0].today,
          opened7d: openedRes.rows[0].d7,
          opened30d: openedRes.rows[0].d30,
          avgResolutionHours: avgHours === null ? null : Number(avgHours),
          daily: dailyRes.rows.map((r) => ({
            dia: r.dia,
            abertos: r.abertos,
            concluidos: r.concluidos,
          })),
          byWeekdayHour: heatmapRes.rows.map((r) => ({
            dow: r.dow,
            bloco: r.bloco,
            count: r.c,
          })),
          monthly: monthlyRes.rows.map((r) => ({
            mes: r.mes,
            horas: r.horas === null ? null : Number(r.horas),
            concluidos: r.concluidos,
          })),
          byAttendant: byAttendantRes.rows.map((r) => ({
            name: r.name,
            count: r.c,
          })),
        });
      } catch (err) {
        console.error("Erro ao buscar estatísticas de chamados:", err);
        res.status(500).json({ error: "Erro ao buscar estatísticas." });
      }
    },
  );


  return router;
};
