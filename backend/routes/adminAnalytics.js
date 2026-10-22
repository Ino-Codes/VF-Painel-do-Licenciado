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

// ═══════════════════════════════════════════════════════════════════════════
// Estatísticas dos cursos
// ═══════════════════════════════════════════════════════════════════════════
// Não há matrícula explícita (user_courses nunca é preenchida): um aluno
// INICIOU um curso quando concluiu ao menos uma aula dele, e CONCLUIU quando
// concluiu todas — a mesma regra que libera o certificado (routes/courses.js).
// O quiz não entra na conclusão; é medido à parte, pela melhor nota de cada
// aluno.
//
// Parâmetros: $1 = company_id (null = todas as empresas), $2 = público.
// Cursos sem nenhuma aula ficam de fora (não há o que concluir).
const PUBLICOS = ["todos", "internos", "vpartners"];

const ESCOPO_CURSOS = `
  WITH alunos AS (
    SELECT u.id, u.nome, u.avatar_url, s.nome AS setor
      FROM users u
      LEFT JOIN setores s ON s.id = u.setor_id
     WHERE $2::text = 'todos'
        OR ($2::text = 'internos') = EXISTS (
             SELECT 1 FROM group_permissions gp
              WHERE gp.group_id = u.group_id
                AND gp.permission_key = 'internal_access')
  ),
  cursos AS (
    SELECT c.id, c.title, c.is_active, co.name AS empresa,
           COUNT(l.id)::int AS total_aulas
      FROM courses c
      JOIN modules m ON m.course_id = c.id
      JOIN lessons l ON l.module_id = m.id
      LEFT JOIN companies co ON co.id = c.company_id
     WHERE $1::int IS NULL OR c.company_id = $1::int
     GROUP BY c.id, c.title, c.is_active, co.name
  ),
  feitas AS (
    SELECT p.user_id, m.course_id, p.completed_at
      FROM progress p
      JOIN lessons l ON l.id = p.lesson_id
      JOIN modules m ON m.id = l.module_id
      JOIN cursos c ON c.id = m.course_id
      JOIN alunos a ON a.id = p.user_id
  ),
  matriculas AS (
    SELECT f.user_id, f.course_id,
           COUNT(*)::int AS aulas,
           COUNT(*) >= MAX(c.total_aulas) AS concluido
      FROM feitas f
      JOIN cursos c ON c.id = f.course_id
     GROUP BY f.user_id, f.course_id
  ),
  quiz_melhor AS (
    SELECT q.course_id, qa.user_id, q.passing_score,
           MAX(qa.score) AS nota,
           BOOL_OR(qa.passed) AS aprovado,
           COUNT(*)::int AS tentativas
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      JOIN cursos c ON c.id = q.course_id
      JOIN alunos a ON a.id = qa.user_id
     GROUP BY q.course_id, qa.user_id, q.passing_score
  )`;

const router = express.Router();

const { isLoggedIn, checkPermission } = require("../middleware/auth.js");

module.exports = function (pool) {
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

  // --- ESTATÍSTICAS DOS CURSOS ---
  // ?empresa=<slug>|all filtra os cursos pela empresa; ?publico=todos|internos|vpartners
  // filtra os alunos (interno = grupo com internal_access).
  router.get(
    "/courses",
    isLoggedIn,
    checkPermission("analytics.view"),
    async (req, res) => {
      const publico = PUBLICOS.includes(req.query.publico)
        ? req.query.publico
        : "todos";

      try {
        // Sem empresa (ou "all") = todas. Slug desconhecido não casa com
        // nenhum curso, em vez de cair silenciosamente em "todas".
        let companyId = null;
        const empresa = req.query.empresa;
        if (empresa && empresa !== "all") {
          const r = await pool.query("SELECT id FROM companies WHERE slug = $1", [
            empresa,
          ]);
          companyId = r.rows.length ? r.rows[0].id : -1;
        }
        const params = [companyId, publico];
        const q = (sql) => pool.query(`${ESCOPO_CURSOS} ${sql}`, params);

        const [resumo, quiz, semanal, porCurso, notas, porSetor, ranking] =
          await Promise.all([
            q(`
              SELECT
                (SELECT COUNT(*) FROM cursos WHERE is_active)::int AS cursos_ativos,
                (SELECT COUNT(DISTINCT user_id) FROM feitas)::int AS alunos,
                (SELECT COUNT(*) FROM feitas)::int AS aulas,
                (SELECT COUNT(*) FROM feitas
                  WHERE completed_at >= NOW() - INTERVAL '30 days')::int AS aulas_30d,
                (SELECT COUNT(*) FROM feitas
                  WHERE completed_at >= NOW() - INTERVAL '60 days'
                    AND completed_at < NOW() - INTERVAL '30 days')::int AS aulas_30d_anterior,
                (SELECT COUNT(*) FROM matriculas)::int AS iniciados,
                (SELECT COUNT(*) FROM matriculas WHERE concluido)::int AS concluidos,
                (SELECT COUNT(*)
                   FROM certificates ce
                   JOIN cursos c ON c.id = ce.course_id
                   JOIN alunos a ON a.id = ce.user_id)::int AS certificados`),
            q(`
              SELECT COUNT(*)::int AS alunos,
                     COUNT(*) FILTER (WHERE aprovado)::int AS aprovados,
                     ROUND(AVG(nota), 1)::float AS nota_media,
                     ROUND(AVG(tentativas), 1)::float AS tentativas_media
                FROM quiz_melhor`),
            // Últimas 12 semanas (segunda a domingo, horário de São Paulo),
            // incluindo as semanas sem atividade.
            q(`
              SELECT to_char(s.semana, 'YYYY-MM-DD') AS semana,
                     COUNT(f.user_id)::int AS aulas,
                     COUNT(DISTINCT f.user_id)::int AS alunos
                FROM generate_series(
                       date_trunc('week', ${paraLocal("NOW()")}) - INTERVAL '11 weeks',
                       date_trunc('week', ${paraLocal("NOW()")}),
                       INTERVAL '1 week'
                     ) AS s(semana)
                LEFT JOIN feitas f
                  ON date_trunc('week', ${paraLocal("f.completed_at")}) = s.semana
               GROUP BY s.semana
               ORDER BY s.semana`),
            q(`
              SELECT c.id, c.title AS titulo, c.empresa, c.is_active AS ativo,
                     c.total_aulas,
                     COUNT(mt.user_id)::int AS iniciados,
                     COUNT(mt.user_id) FILTER (WHERE mt.concluido)::int AS concluidos,
                     ROUND(AVG(mt.aulas::numeric / c.total_aulas) * 100)::int AS progresso_medio,
                     qz.alunos AS quiz_alunos,
                     qz.aprovados AS quiz_aprovados,
                     qz.nota_media AS quiz_nota_media,
                     qz.nota_corte
                FROM cursos c
                LEFT JOIN matriculas mt ON mt.course_id = c.id
                LEFT JOIN (
                  SELECT course_id,
                         COUNT(*)::int AS alunos,
                         COUNT(*) FILTER (WHERE aprovado)::int AS aprovados,
                         ROUND(AVG(nota), 1)::float AS nota_media,
                         MAX(passing_score)::int AS nota_corte
                    FROM quiz_melhor
                   GROUP BY course_id
                ) qz ON qz.course_id = c.id
               GROUP BY c.id, c.title, c.empresa, c.is_active, c.total_aulas,
                        qz.alunos, qz.aprovados, qz.nota_media, qz.nota_corte
               ORDER BY iniciados DESC, c.title`),
            // Melhor nota de cada aluno em cada quiz, em faixas fixas.
            q(`
              SELECT COUNT(*) FILTER (WHERE nota < 50)::int AS f0,
                     COUNT(*) FILTER (WHERE nota >= 50 AND nota < 70)::int AS f1,
                     COUNT(*) FILTER (WHERE nota >= 70 AND nota < 90)::int AS f2,
                     COUNT(*) FILTER (WHERE nota >= 90)::int AS f3
                FROM quiz_melhor`),
            q(`
              SELECT COALESCE(a.setor, 'Sem setor') AS setor,
                     COUNT(*)::int AS aulas,
                     COUNT(DISTINCT f.user_id)::int AS alunos
                FROM feitas f
                JOIN alunos a ON a.id = f.user_id
               GROUP BY 1
               ORDER BY aulas DESC
               LIMIT 8`),
            q(`
              SELECT a.id, a.nome, a.avatar_url, a.setor,
                     COUNT(*)::int AS aulas,
                     (SELECT COUNT(*) FROM matriculas mt
                       WHERE mt.user_id = a.id AND mt.concluido)::int AS cursos_concluidos,
                     to_char(MAX(${paraLocal("f.completed_at")}), 'YYYY-MM-DD') AS ultima_atividade
                FROM feitas f
                JOIN alunos a ON a.id = f.user_id
               GROUP BY a.id, a.nome, a.avatar_url, a.setor
               ORDER BY aulas DESC, MAX(f.completed_at) DESC
               LIMIT 10`),
          ]);

        const r = resumo.rows[0];
        const qz = quiz.rows[0];
        const n = notas.rows[0];

        res.json({
          resumo: {
            cursosAtivos: r.cursos_ativos,
            alunos: r.alunos,
            aulas: r.aulas,
            aulas30d: r.aulas_30d,
            aulas30dAnterior: r.aulas_30d_anterior,
            iniciados: r.iniciados,
            concluidos: r.concluidos,
            certificados: r.certificados,
            quiz: {
              alunos: qz.alunos,
              aprovados: qz.aprovados,
              notaMedia: qz.nota_media,
              tentativasMedia: qz.tentativas_media,
            },
          },
          semanal: semanal.rows,
          porCurso: porCurso.rows.map((c) => ({
            id: c.id,
            titulo: c.titulo,
            empresa: c.empresa,
            ativo: c.ativo,
            totalAulas: c.total_aulas,
            iniciados: c.iniciados,
            concluidos: c.concluidos,
            progressoMedio: c.progresso_medio,
            quizAlunos: c.quiz_alunos || 0,
            quizAprovados: c.quiz_aprovados || 0,
            quizNotaMedia: c.quiz_nota_media,
            notaCorte: c.nota_corte,
          })),
          notas: [n.f0, n.f1, n.f2, n.f3],
          porSetor: porSetor.rows,
          ranking: ranking.rows.map((u) => ({
            id: u.id,
            nome: u.nome,
            avatarUrl: u.avatar_url,
            setor: u.setor,
            aulas: u.aulas,
            cursosConcluidos: u.cursos_concluidos,
            ultimaAtividade: u.ultima_atividade,
          })),
        });
      } catch (err) {
        console.error("Erro ao buscar estatísticas de cursos:", err);
        res.status(500).json({ error: "Erro ao buscar estatísticas de cursos." });
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

        // Mapa de calor: dia da semana x período do dia. Quatro períodos do
        // expediente e dois fora dele, na ordem de um dia que começa às 8h:
        //   0: 08–10  1: 10–13  2: 13–15  3: 15–18  4: 18–24  5: 00–08
        const heatmapQuery = pool.query(
          `SELECT EXTRACT(DOW FROM local)::int AS dow,
                  CASE
                    WHEN EXTRACT(HOUR FROM local) < 8  THEN 5
                    WHEN EXTRACT(HOUR FROM local) < 10 THEN 0
                    WHEN EXTRACT(HOUR FROM local) < 13 THEN 1
                    WHEN EXTRACT(HOUR FROM local) < 15 THEN 2
                    WHEN EXTRACT(HOUR FROM local) < 18 THEN 3
                    ELSE 4
                  END AS periodo,
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

        // Avaliações do atendimento (1–5 estrelas, dadas pelo solicitante).
        // `concluidos` permite mostrar a taxa de resposta: quantos dos
        // chamados concluídos foram avaliados.
        const ratingQuery = pool.query(
          `SELECT COUNT(*) FILTER (WHERE rating IS NOT NULL)::int AS total,
                  AVG(rating)::float AS media,
                  COUNT(*) FILTER (WHERE status = 'concluido')::int AS concluidos,
                  COUNT(*) FILTER (WHERE rating = 1)::int AS n1,
                  COUNT(*) FILTER (WHERE rating = 2)::int AS n2,
                  COUNT(*) FILTER (WHERE rating = 3)::int AS n3,
                  COUNT(*) FILTER (WHERE rating = 4)::int AS n4,
                  COUNT(*) FILTER (WHERE rating = 5)::int AS n5
             FROM tickets`,
        );

        // Média por atendente (quem atendeu o chamado avaliado).
        const ratingByAttendantQuery = pool.query(
          `SELECT COALESCE(NULLIF(TRIM(attendant_name), ''), 'Sem atendente') AS name,
                  AVG(rating)::float AS media,
                  COUNT(*)::int AS c
             FROM tickets
            WHERE rating IS NOT NULL
            GROUP BY 1
            ORDER BY media DESC, c DESC
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
          waitMedianRes,
          waitMonthlyRes,
          ratingRes,
          ratingByAttendantRes,
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
          ratingQuery,
          ratingByAttendantQuery,
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
          byWeekdayPeriod: heatmapRes.rows.map((r) => ({
            dow: r.dow,
            periodo: r.periodo,
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
          // Avaliação do atendimento.
          rating: {
            total: ratingRes.rows[0].total,
            media: ratingRes.rows[0].media,
            concluidos: ratingRes.rows[0].concluidos,
            // Quantidade de avaliações com 1, 2, 3, 4 e 5 estrelas.
            distribuicao: [1, 2, 3, 4, 5].map((n) => ratingRes.rows[0][`n${n}`]),
          },
          ratingByAttendant: ratingByAttendantRes.rows.map((r) => ({
            name: r.name,
            media: r.media,
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
