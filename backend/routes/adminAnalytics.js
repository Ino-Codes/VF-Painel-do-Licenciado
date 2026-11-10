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

// ═══════════════════════════════════════════════════════════════════════════
// Atividade no Painel
// ═══════════════════════════════════════════════════════════════════════════
const PERIODOS_ATIVIDADE = [30, 90, 180];

// 'interno' (colaborador) ou 'vpartner', pela mesma regra de companyAccess.js.
const publicoSql = (u) => `CASE WHEN EXISTS (
    SELECT 1 FROM group_permissions gp
     WHERE gp.group_id = ${u}.group_id AND gp.permission_key = 'internal_access'
  ) THEN 'interno' ELSE 'vpartner' END`;

const { isLoggedIn, checkPermission } = require("../middleware/auth.js");

module.exports = function (pool) {
  // --- ESTATÍSTICAS DO PAINEL: aba Atividade ---
  // Uso do Painel medido pelos logins. A sessão dura 12h, então quem usa o
  // Painel faz login no dia: "ativo" = fez login no intervalo.
  //
  // Público pela regra atual de acesso (companyAccess.js): colaborador é quem
  // tem a permissão internal_access no grupo; quem não tem é V-Partner.
  // Logins de usuários já excluídos ficam fora das séries por público.
  router.get(
    "/system-usage",
    isLoggedIn,
    checkPermission("analytics.view"),
    async (req, res) => {
      const dias = PERIODOS_ATIVIDADE.includes(Number(req.query.dias))
        ? Number(req.query.dias)
        : 90;
      // 30 dias por semana dariam só 5 pontos: nesse período a série é diária.
      const unidade = dias <= 30 ? "day" : "week";

      try {
        const usuariosQuery = pool.query(
          `SELECT u.id, u.nome, u.email,
                  ${publicoSql("u")} AS publico,
                  l.ultimo AS ultimo_login,
                  CASE WHEN l.ultimo IS NULL THEN 'nunca'
                       WHEN l.ultimo > now() - interval '30 days' THEN 'ativo30'
                       WHEN l.ultimo > now() - interval '90 days' THEN 'ativo90'
                       ELSE 'inativo' END AS faixa,
                  COALESCE(l.ultimo > now() - interval '7 days', false) AS ativo7,
                  COALESCE(l.ultimo > now() - make_interval(days => $1), false) AS ativo_periodo
             FROM users u
             LEFT JOIN (
               SELECT user_id, MAX(created_at) AS ultimo
                 FROM activity_logs
                WHERE action = 'Login Bem-Sucedido'
                GROUP BY user_id
             ) l ON l.user_id = u.id
            ORDER BY u.nome`,
          [dias],
        );

        // Eixo completo (períodos sem nenhum evento aparecem com zero), em
        // dias ou semanas no horário de São Paulo.
        const serieQuery = pool.query(
          `WITH eixo AS (
             SELECT generate_series(
                      date_trunc($2, (now() AT TIME ZONE 'America/Sao_Paulo') - make_interval(days => $1 - 1)),
                      date_trunc($2, now() AT TIME ZONE 'America/Sao_Paulo'),
                      ('1 ' || $2)::interval
                    ) AS inicio
           ),
           eventos AS (
             SELECT date_trunc($2, a.created_at AT TIME ZONE 'America/Sao_Paulo') AS inicio,
                    a.action, a.user_id,
                    ${publicoSql("u")} AS publico,
                    -- Falha de quem tem conta (senha errada) x e-mail que não existe.
                    (a.action = 'Falha no Login' AND EXISTS (
                       SELECT 1 FROM users x WHERE x.email = lower(btrim(a.user_email))
                    )) AS falha_de_cadastrado
               FROM activity_logs a
               LEFT JOIN users u ON u.id = a.user_id
              WHERE a.created_at >= (SELECT MIN(inicio) FROM eixo) AT TIME ZONE 'America/Sao_Paulo'
                AND a.action IN ('Login Bem-Sucedido', 'Falha no Login', '2FA Falhou', 'Senha Redefinida')
           )
           SELECT to_char(e.inicio, 'YYYY-MM-DD') AS inicio,
                  COUNT(DISTINCT ev.user_id) FILTER (WHERE ev.action = 'Login Bem-Sucedido' AND ev.user_id IS NOT NULL AND ev.publico = 'interno')::int AS internos,
                  COUNT(DISTINCT ev.user_id) FILTER (WHERE ev.action = 'Login Bem-Sucedido' AND ev.user_id IS NOT NULL AND ev.publico = 'vpartner')::int AS vpartners,
                  COUNT(ev.action) FILTER (WHERE ev.action = 'Login Bem-Sucedido')::int AS sucesso,
                  COUNT(ev.action) FILTER (WHERE ev.action = 'Falha no Login')::int AS falhas,
                  COUNT(ev.action) FILTER (WHERE ev.falha_de_cadastrado)::int AS falhas_senha,
                  COUNT(ev.action) FILTER (WHERE ev.action = '2FA Falhou')::int AS falhas_2fa,
                  COUNT(ev.action) FILTER (WHERE ev.action = 'Senha Redefinida')::int AS senhas_redefinidas
             FROM eixo e
             LEFT JOIN eventos ev ON ev.inicio = e.inicio
            GROUP BY e.inicio
            ORDER BY e.inicio`,
          [dias, unidade],
        );

        const diaHoraQuery = pool.query(
          `SELECT EXTRACT(DOW FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int AS dow,
                  EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int AS hora,
                  COUNT(*)::int AS count
             FROM activity_logs
            WHERE action = 'Login Bem-Sucedido'
              AND created_at > now() - make_interval(days => $1)
            GROUP BY 1, 2`,
          [dias],
        );

        // A falha de senha não tem user_id (o login não passou): o e-mail
        // digitado diz se era de alguém cadastrado ou um e-mail qualquer.
        const acessoQuery = pool.query(
          `SELECT COUNT(*) FILTER (WHERE a.action = 'Login Bem-Sucedido')::int AS sucesso,
                  COUNT(*) FILTER (WHERE a.action = 'Falha no Login')::int AS falhas,
                  COUNT(*) FILTER (WHERE a.action = 'Falha no Login' AND u.id IS NOT NULL)::int AS falhas_cadastrados,
                  COUNT(DISTINCT u.id) FILTER (WHERE a.action = 'Falha no Login')::int AS contas_com_falha,
                  COUNT(*) FILTER (WHERE a.action = '2FA Falhou')::int AS falhas_2fa,
                  COUNT(*) FILTER (WHERE a.action = 'Senha Redefinida')::int AS senhas_redefinidas
             FROM activity_logs a
             LEFT JOIN users u ON a.action = 'Falha no Login' AND u.email = lower(btrim(a.user_email))
            WHERE a.created_at > now() - make_interval(days => $1)
              AND a.action IN ('Login Bem-Sucedido', 'Falha no Login', '2FA Falhou', 'Senha Redefinida')`,
          [dias],
        );

        const downloadsQuery = pool.query(
          `SELECT COUNT(*)::int AS count
             FROM activity_logs
            WHERE action = 'DOWNLOAD_FILE'
              AND created_at > now() - make_interval(days => $1)`,
          [dias],
        );

        // O log grava 'baixou o arquivo "Nome".': tira as aspas e o ponto
        // final para o nome aparecer limpo (e variações caírem juntas).
        const topDownloadsQuery = pool.query(
          `SELECT btrim(regexp_replace(
                    SUBSTRING(details FROM 'baixou o arquivo (.*)'),
                    '^"|"[.]?$', '', 'g'
                  )) AS filename,
                  COUNT(*)::int AS count
             FROM activity_logs
            WHERE action = 'DOWNLOAD_FILE'
              AND created_at > now() - make_interval(days => $1)
            GROUP BY filename
            ORDER BY count DESC
            LIMIT 5`,
          [dias],
        );

        const [usuariosRes, serieRes, diaHoraRes, acessoRes, downloadsRes, topDownloadsRes] =
          await Promise.all([
            usuariosQuery,
            serieQuery,
            diaHoraQuery,
            acessoQuery,
            downloadsQuery,
            topDownloadsQuery,
          ]);

        const publicos = {};
        for (const chave of ["interno", "vpartner"]) {
          publicos[chave] = {
            cadastrados: 0,
            ativos7: 0,
            ativosPeriodo: 0,
            faixas: { ativo30: 0, ativo90: 0, inativo: 0, nunca: 0 },
          };
        }
        for (const u of usuariosRes.rows) {
          const p = publicos[u.publico];
          p.cadastrados++;
          if (u.ativo7) p.ativos7++;
          if (u.ativo_periodo) p.ativosPeriodo++;
          p.faixas[u.faixa]++;
        }

        const acesso = acessoRes.rows[0];
        res.json({
          dias,
          granularidade: unidade === "day" ? "dia" : "semana",
          publicos,
          // Cada usuário com a sua faixa: o gráfico de adoção lista quem está
          // numa faixa ao clicar nela.
          usuarios: usuariosRes.rows.map((u) => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            publico: u.publico,
            faixa: u.faixa,
            ultimoLogin: u.ultimo_login,
          })),
          serie: serieRes.rows.map((r) => ({
            inicio: r.inicio,
            internos: r.internos,
            vpartners: r.vpartners,
            sucesso: r.sucesso,
            falhas: r.falhas,
            falhasSenha: r.falhas_senha,
            falhasEmail: r.falhas - r.falhas_senha,
            falhas2fa: r.falhas_2fa,
            senhasRedefinidas: r.senhas_redefinidas,
          })),
          porDiaHora: diaHoraRes.rows,
          acesso: {
            sucesso: acesso.sucesso,
            falhas: acesso.falhas,
            falhasCadastrados: acesso.falhas_cadastrados,
            contasComFalha: acesso.contas_com_falha,
            falhas2fa: acesso.falhas_2fa,
            senhasRedefinidas: acesso.senhas_redefinidas,
          },
          totalDownloads: downloadsRes.rows[0].count,
          topDownloads: topDownloadsRes.rows.map((row) => ({
            name: row.filename || "Arquivo Desconhecido",
            count: row.count,
          })),
        });
      } catch (err) {
        console.error("Erro ao buscar estatísticas de uso:", err);
        res.status(500).json({ error: "Erro ao buscar estatísticas." });
      }
    },
  );

  // --- ESTATÍSTICAS DO PAINEL: aba Eneagrama ---
  // Público = quem tem acesso ao teste (permissão enneagram.view no grupo),
  // mais quem já fez o teste e depois perdeu o acesso — o resultado continua
  // valendo. Pendente = tem acesso e ainda não fez.
  //
  // O teste tem 20 pares de afirmações e cada escolha soma 1 ponto ao tipo
  // escolhido. Como os tipos aparecem 4 ou 5 vezes, a pontuação bruta não é
  // comparável entre tipos: vai junto quantas vezes cada tipo é oferecido
  // (`aparicoes`) para a tela mostrar a % de escolha.
  router.get(
    "/enneagram-stats",
    isLoggedIn,
    checkPermission("analytics.view"),
    async (req, res) => {
      try {
        const tiposQuery = pool.query(
          "SELECT id, name FROM enneagram_types ORDER BY id",
        );

        const aparicoesQuery = pool.query(
          `SELECT tipo, COUNT(*)::int AS vezes
             FROM (SELECT type_a AS tipo FROM enneagram_questions
                   UNION ALL
                   SELECT type_b FROM enneagram_questions) x
            GROUP BY tipo`,
        );

        const pessoasQuery = pool.query(
          `SELECT u.id, u.nome,
                  COALESCE(s.nome, u.setor) AS setor,
                  r.dominant_type,
                  ARRAY[r.score_1, r.score_2, r.score_3, r.score_4, r.score_5,
                        r.score_6, r.score_7, r.score_8, r.score_9] AS scores,
                  r.completed_at
             FROM users u
             LEFT JOIN setores s ON s.id = u.setor_id
             LEFT JOIN user_enneagram_results r ON r.user_id = u.id
            WHERE r.id IS NOT NULL
               OR EXISTS (
                    SELECT 1 FROM group_permissions gp
                     WHERE gp.group_id = u.group_id
                       AND gp.permission_key = 'enneagram.view'
                  )
            ORDER BY u.nome`,
        );

        const [tiposRes, aparicoesRes, pessoasRes] = await Promise.all([
          tiposQuery,
          aparicoesQuery,
          pessoasQuery,
        ]);

        const aparicoes = Array(9).fill(0);
        for (const r of aparicoesRes.rows) {
          if (r.tipo >= 1 && r.tipo <= 9) aparicoes[r.tipo - 1] = r.vezes;
        }

        const resultados = [];
        const pendentes = [];
        const porSetor = new Map();
        for (const p of pessoasRes.rows) {
          const setor = p.setor || "Sem setor";
          const s = porSetor.get(setor) || { setor, total: 0, concluidos: 0 };
          s.total++;
          if (p.dominant_type) {
            s.concluidos++;
            resultados.push({
              userId: p.id,
              nome: p.nome,
              setor,
              tipo: p.dominant_type,
              scores: p.scores.map((n) => n ?? 0),
              concluidoEm: p.completed_at,
            });
          } else {
            pendentes.push({ userId: p.id, nome: p.nome, setor });
          }
          porSetor.set(setor, s);
        }

        const ultimoTeste = resultados.reduce(
          (max, r) => (r.concluidoEm && (!max || r.concluidoEm > max) ? r.concluidoEm : max),
          null,
        );

        res.json({
          tipos: tiposRes.rows.map((t) => ({ id: t.id, nome: t.name })),
          aparicoes,
          participacao: {
            total: pessoasRes.rows.length,
            concluidos: resultados.length,
          },
          ultimoTeste,
          setores: [...porSetor.values()].sort(
            (a, b) => b.total - a.total || a.setor.localeCompare(b.setor, "pt-BR"),
          ),
          resultados,
          pendentes,
        });
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

        // Por tipo: só o que o ATENDENTE classificou (classified_at). Os tipos
        // escolhidos pelo solicitante, antes da mudança, vão à parte — eram
        // distorcidos (muito "bug" para furar a fila). Ver migration 0050.
        const byTypeQuery = pool.query(
          `SELECT type,
                  (classified_at IS NOT NULL) AS do_atendente,
                  COUNT(*)::int AS c
             FROM tickets
            WHERE type IS NOT NULL
            GROUP BY 1, 2
            ORDER BY c DESC`,
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
          byType: byTypeRes.rows
            .filter((r) => r.do_atendente)
            .map((r) => ({ type: r.type, count: r.c })),
          byTypeSolicitante: byTypeRes.rows
            .filter((r) => !r.do_atendente)
            .map((r) => ({ type: r.type, count: r.c })),
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
