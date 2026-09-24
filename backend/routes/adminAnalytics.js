const express = require("express");

// ═══════════════════════════════════════════════════════════════════════════
// Tempos de atendimento da Central de Chamados
// ═══════════════════════════════════════════════════════════════════════════
// Duas métricas, medidas na MESMA régua para poderem ser comparadas:
//   • espera até o início — abertura → 1º 'andamento'
//   • resolução           — abertura → 1º 'concluido', menos as pausas
// Ambas em HORÁRIO COMERCIAL, e os gráficos usam a MEDIANA (com o p90 como
// referência da cauda). Com poucos chamados, um caso atípico move a média
// inteira; a mediana mostra o chamado típico.
//
// Referências de tempo:
//   abertura = tickets.created_at — criar chamado não grava evento; o
//              histórico só começa quando alguém muda o status.
//   eventos  = ticket_status_history.changed_at.
// created_at é `timestamp` (UTC, sem fuso) e changed_at é `timestamptz`, por
// isso as conversões para o horário de parede de São Paulo diferem.

// Expediente: seg–sex, 08:30–12:00 e 13:00–18:18 (São Paulo). Feriados não
// são descontados.
const EXPEDIENTE_SQL = `(VALUES (time '08:30', time '12:00'), (time '13:00', time '18:18'))`;

// timestamptz → horário de parede de São Paulo.
const paraLocal = (tstz) => `(${tstz} AT TIME ZONE 'America/Sao_Paulo')`;

// tickets.created_at (UTC sem fuso) → horário de parede de São Paulo.
const ABERTURA_LOCAL = `((t.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')`;

// Segundos de expediente entre dois horários de parede (expressões SQL).
// Gera os dias do intervalo, cruza com as janelas do expediente e soma a
// sobreposição de cada janela com o intervalo.
const segundosUteis = (ini, fim) => `(
  SELECT COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (
           LEAST(g.d::date + w.fim, ${fim}) - GREATEST(g.d::date + w.ini, ${ini})
         )))), 0)
    FROM generate_series((${ini})::date, (${fim})::date, INTERVAL '1 day') AS g(d)
    CROSS JOIN ${EXPEDIENTE_SQL} AS w(ini, fim)
   WHERE EXTRACT(ISODOW FROM g.d) < 6
)`;

// ── Resolução ─────────────────────────────────────────────────────────────
// A pausa vai de cada evento 'pausado' até o evento seguinte do mesmo
// chamado, também medida em expediente. LEAST(..., t1) impede que uma pausa
// posterior à conclusão entre na conta; GREATEST(..., 0) protege contra
// histórico inconsistente.
const CTE_RESOLUCAO = `
  closed AS (
    SELECT ticket_id, MIN(changed_at) AS t1
      FROM ticket_status_history
     WHERE to_status = 'concluido'
     GROUP BY ticket_id
  ),
  eventos AS (
    SELECT ticket_id,
           to_status,
           changed_at,
           LEAD(changed_at) OVER (
             PARTITION BY ticket_id ORDER BY changed_at
           ) AS proximo
      FROM ticket_status_history
  ),
  pausas AS (
    SELECT e.ticket_id,
           SUM(${segundosUteis(
             paraLocal("e.changed_at"),
             paraLocal("LEAST(COALESCE(e.proximo, c.t1), c.t1)"),
           )}) AS segundos
      FROM eventos e
      JOIN closed c ON c.ticket_id = e.ticket_id
     WHERE e.to_status = 'pausado'
       AND e.changed_at < c.t1
     GROUP BY e.ticket_id
  ),
  resolucao AS (
    SELECT c.ticket_id,
           c.t1,
           GREATEST(
             ${segundosUteis(ABERTURA_LOCAL, paraLocal("c.t1"))}
             - COALESCE(p.segundos, 0),
             0
           ) / 3600.0 AS horas
      FROM closed c
      JOIN tickets t ON t.id = c.ticket_id
      LEFT JOIN pausas p ON p.ticket_id = c.ticket_id
     WHERE c.t1 >= (t.created_at AT TIME ZONE 'UTC')
  )`;

// ── Espera até o início ───────────────────────────────────────────────────
// PRIMEIRO 'andamento': retomar um chamado pausado também grava 'andamento',
// e o último mediria até a retomada.
const CTE_ESPERA = `
  inicio AS (
    SELECT ticket_id, MIN(changed_at) AS t_inicio
      FROM ticket_status_history
     WHERE to_status = 'andamento'
     GROUP BY ticket_id
  ),
  espera AS (
    SELECT i.ticket_id,
           i.t_inicio,
           ${segundosUteis(ABERTURA_LOCAL, paraLocal("i.t_inicio"))} / 3600.0 AS horas
      FROM inicio i
      JOIN tickets t ON t.id = i.ticket_id
     WHERE i.t_inicio >= (t.created_at AT TIME ZONE 'UTC')
  )`;
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

        // Tempo médio de resolução (ver CTE_RESOLUCAO).
        const avgResolutionQuery = pool.query(
          `WITH ${CTE_RESOLUCAO}
           SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY horas) AS hours
             FROM resolucao`,
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
          `WITH ${CTE_RESOLUCAO}
           SELECT to_char(date_trunc('month', (t1 AT TIME ZONE $1)), 'YYYY-MM') AS mes,
                  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY horas) AS horas,
                  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY horas) AS p90,
                  COUNT(*)::int AS concluidos
             FROM resolucao
            WHERE t1 >= date_trunc('month', NOW()) - INTERVAL '5 months'
            GROUP BY 1, date_trunc('month', (t1 AT TIME ZONE $1))
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

        // Espera até o início (ver CTE_ESPERA). Mediana e não média: um só
        // chamado esquecido puxaria a média para cima e esconderia o caso
        // típico.
        const waitMedianQuery = pool.query(
          `WITH ${CTE_ESPERA}
           SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY horas) AS hours,
                  COUNT(*)::int AS n
             FROM espera`,
        );

        // Mesma métrica por mês — agrupada pelo mês do início, assim como a
        // resolução é agrupada pelo mês da conclusão.
        const waitMonthlyQuery = pool.query(
          `WITH ${CTE_ESPERA}
           SELECT to_char(date_trunc('month', (t_inicio AT TIME ZONE $1)), 'YYYY-MM') AS mes,
                  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY horas) AS horas,
                  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY horas) AS p90,
                  COUNT(*)::int AS iniciados
             FROM espera
            WHERE t_inicio >= date_trunc('month', NOW()) - INTERVAL '5 months'
            GROUP BY 1
            ORDER BY 1`,
          [TZ],
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
          waitMedianRes,
          waitMonthlyRes,
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
          waitMedianQuery,
          waitMonthlyQuery,
        ]);

        // A série mensal junta as duas métricas pelo mês. Um mês pode ter
        // chamados iniciados e nenhum concluído (ou o contrário), então é a
        // UNIÃO dos meses, não só os da resolução.
        const porMes = new Map();
        monthlyRes.rows.forEach((r) => {
          porMes.set(r.mes, {
            mes: r.mes,
            horas: r.horas === null ? null : Number(r.horas),
            horasP90: r.p90 === null ? null : Number(r.p90),
            concluidos: r.concluidos,
            espera: null,
            esperaP90: null,
            iniciados: 0,
          });
        });
        waitMonthlyRes.rows.forEach((r) => {
          const atual = porMes.get(r.mes) || {
            mes: r.mes,
            horas: null,
            horasP90: null,
            concluidos: 0,
          };
          porMes.set(r.mes, {
            ...atual,
            espera: r.horas === null ? null : Number(r.horas),
            esperaP90: r.p90 === null ? null : Number(r.p90),
            iniciados: r.iniciados,
          });
        });
        const monthly = [...porMes.values()].sort((a, b) =>
          a.mes.localeCompare(b.mes),
        );

        const waitMedian = waitMedianRes.rows[0].hours;

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
          // Mediana, em horas úteis, da abertura à conclusão (sem pausas).
          medianResolutionHours: avgHours === null ? null : Number(avgHours),
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
          monthly,
          // Mediana, em horas úteis, da abertura ao início do atendimento.
          medianWaitHours: waitMedian === null ? null : Number(waitMedian),
          startedCount: waitMedianRes.rows[0].n,
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
