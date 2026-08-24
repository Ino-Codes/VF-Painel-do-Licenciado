const express = require("express");
const router = express.Router();

const { isLoggedIn, checkPermission } = require("../middleware/auth.js");
const { sendEventNotifications } = require("../cron.js");

// ───────────────────────────────────────────────────────────────────────────
// Integração Jira (Estatísticas de Desenvolvimento)
// As credenciais nunca vão para o frontend: ficam em variáveis de ambiente e
// todas as chamadas ao Jira passam por este backend, que ainda faz cache.
// ───────────────────────────────────────────────────────────────────────────
const JIRA_BASE_URL = (
  process.env.JIRA_BASE_URL || "https://valorfiscal-team.atlassian.net"
).replace(/\/$/, "");
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY || "SCRUM";
const JIRA_BOARD_ID = process.env.JIRA_BOARD_ID || "1";
const JIRA_SPRINT_FIELD = process.env.JIRA_SPRINT_FIELD || "customfield_10020";
const JIRA_CACHE_MS = 120000; // 2 minutos

const jiraConfigured = () => Boolean(JIRA_EMAIL && JIRA_API_TOKEN);
const jiraAuthHeader = () =>
  "Basic " +
  Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

// GET simples na REST API do Jira
async function jiraFetch(path) {
  const res = await fetch(`${JIRA_BASE_URL}${path}`, {
    headers: { Authorization: jiraAuthHeader(), Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// Busca issues por JQL, paginando via nextPageToken (endpoint /search/jql)
async function jiraSearch(jql, fields) {
  const issues = [];
  let nextPageToken;
  let guard = 0;
  do {
    const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/search/jql`, {
      method: "POST",
      headers: {
        Authorization: jiraAuthHeader(),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jql, fields, maxResults: 100, nextPageToken }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Jira search ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    (data.issues || []).forEach((i) => issues.push(i));
    nextPageToken = data.nextPageToken;
    guard += 1;
  } while (nextPageToken && guard < 30);
  return issues;
}

// Mapeia a categoria de status do Jira para as 3 colunas do quadro
const JIRA_CAT = { new: "todo", indeterminate: "inProgress", done: "done" };

async function buildJiraStats() {
  // 1) Sprint ativa via Agile API (fallback: campo de sprint das próprias issues)
  let sprint = null;
  try {
    const s = await jiraFetch(
      `/rest/agile/1.0/board/${JIRA_BOARD_ID}/sprint?state=active`,
    );
    if (s.values && s.values.length) {
      const a = s.values[0];
      sprint = {
        id: a.id,
        name: a.name,
        goal: a.goal || "",
        startDate: a.startDate || null,
        endDate: a.endDate || null,
      };
    }
  } catch (e) {
    // segue para o fallback com o campo customfield das issues
  }

  // 2) Issues da sprint ativa
  const sprintIssues = await jiraSearch(
    `project = ${JIRA_PROJECT_KEY} AND sprint in openSprints()`,
    ["status", "assignee", "issuetype", "created", "resolutiondate", JIRA_SPRINT_FIELD],
  );

  if (!sprint) {
    for (const it of sprintIssues) {
      const arr = it.fields[JIRA_SPRINT_FIELD];
      if (Array.isArray(arr)) {
        const active = arr.find((sp) => sp.state === "active");
        if (active) {
          sprint = {
            id: active.id,
            name: active.name,
            goal: active.goal || "",
            startDate: active.startDate || null,
            endDate: active.endDate || null,
          };
          break;
        }
      }
    }
  }

  // 3) Agregações da sprint
  const byCategory = { todo: 0, inProgress: 0, done: 0 };
  const statusMap = {};
  const typeMap = {};
  const devMap = {};

  for (const it of sprintIssues) {
    const f = it.fields || {};
    const catKey = f.status?.statusCategory?.key || "new";
    const cat = JIRA_CAT[catKey] || "todo";
    byCategory[cat] += 1;

    const stName = f.status?.name || "—";
    if (!statusMap[stName])
      statusMap[stName] = { name: stName, count: 0, category: cat };
    statusMap[stName].count += 1;

    const tp = f.issuetype?.name || "—";
    typeMap[tp] = (typeMap[tp] || 0) + 1;

    const dev = f.assignee ? f.assignee.displayName : "Sem responsável";
    const avatar = f.assignee?.avatarUrls?.["48x48"] || null;
    if (!devMap[dev])
      devMap[dev] = {
        name: dev,
        avatarUrl: avatar,
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
      };
    devMap[dev].total += 1;
    devMap[dev][cat] += 1;
  }

  // 4) Tempo médio de conclusão (issues resolvidas nos últimos 90 dias)
  let avgCompletionHours = null;
  let resolvedCount = 0;
  try {
    const resolved = await jiraSearch(
      `project = ${JIRA_PROJECT_KEY} AND resolutiondate >= -90d`,
      ["created", "resolutiondate"],
    );
    const durations = [];
    for (const it of resolved) {
      const c = it.fields?.created;
      const r = it.fields?.resolutiondate;
      if (c && r) {
        const d = (new Date(r).getTime() - new Date(c).getTime()) / 3600000;
        if (d >= 0) durations.push(d);
      }
    }
    resolvedCount = durations.length;
    if (durations.length)
      avgCompletionHours =
        durations.reduce((a, b) => a + b, 0) / durations.length;
  } catch (e) {
    // mantém null se a consulta de resolvidas falhar
  }

  let daysRemaining = null;
  if (sprint?.endDate) {
    daysRemaining = Math.ceil(
      (new Date(sprint.endDate).getTime() - Date.now()) / 86400000,
    );
  }

  return {
    configured: true,
    projectKey: JIRA_PROJECT_KEY,
    boardUrl: `${JIRA_BASE_URL}/jira/software/projects/${JIRA_PROJECT_KEY}/boards/${JIRA_BOARD_ID}`,
    sprint: sprint ? { ...sprint, daysRemaining } : null,
    total: sprintIssues.length,
    byCategory,
    byStatus: Object.values(statusMap).sort((a, b) => b.count - a.count),
    byType: Object.entries(typeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    byAssignee: Object.values(devMap).sort((a, b) => b.total - a.total),
    avgCompletionHours,
    resolvedCount,
    updatedAt: new Date().toISOString(),
  };
}

// Unificamos as funções aqui recebendo pool e resend
module.exports = function (pool, resend) {
  // Cache em memória compartilhado entre requisições (evita estourar o Jira)
  let jiraCache = { at: 0, data: null };
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

        const [
          totalRes,
          byStatusRes,
          byTypeRes,
          bySystemRes,
          openedRes,
          avgRes,
        ] = await Promise.all([
          totalQuery,
          byStatusQuery,
          byTypeQuery,
          bySystemQuery,
          openedQuery,
          avgResolutionQuery,
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
        });
      } catch (err) {
        console.error("Erro ao buscar estatísticas de chamados:", err);
        res.status(500).json({ error: "Erro ao buscar estatísticas." });
      }
    },
  );

  // --- ESTATÍSTICAS DE DESENVOLVIMENTO (JIRA) ---
  router.get(
    "/jira",
    isLoggedIn,
    checkPermission("analytics.view"),
    async (req, res) => {
      // Sem credenciais configuradas: responde 200 com configured=false
      // para o frontend exibir instruções em vez de um erro.
      if (!jiraConfigured()) {
        return res.json({ configured: false });
      }
      try {
        const now = Date.now();
        if (jiraCache.data && now - jiraCache.at < JIRA_CACHE_MS) {
          return res.json({ ...jiraCache.data, cached: true });
        }
        const data = await buildJiraStats();
        jiraCache = { at: now, data };
        res.json({ ...data, cached: false });
      } catch (err) {
        console.error("Erro ao buscar estatísticas do Jira:", err.message);
        res
          .status(502)
          .json({ error: "Erro ao consultar o Jira.", detail: err.message });
      }
    },
  );

  return router;
};
