const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/auth.js");

// Certificados dos cursos do Painel (Perfil → Meus Certificados).
//
// A lista sai do PROGRESSO, não da tabela `certificates`: aquela só ganha uma
// linha quando o PDF é baixado pela primeira vez, e quem concluiu sem baixar
// ficaria sem certificado na tela. A regra é a mesma que libera o PDF
// (routes/courses.js): todas as aulas concluídas; a data de conclusão é a da
// última aula. O quiz não entra na conclusão — vem junto só como informação.
module.exports = function (pool) {
  // GET /api/certificates/mine — sempre do usuário do token.
  router.get("/mine", isLoggedIn, async (req, res) => {
    try {
      const result = await pool.query(
        `
        WITH cursos AS (
          SELECT c.id, c.title, c.thumbnail_url, c.is_active,
                 co.slug AS company_slug, co.name AS company_name,
                 COUNT(l.id)::int AS total_aulas
            FROM courses c
            JOIN modules m ON m.course_id = c.id
            JOIN lessons l ON l.module_id = m.id
            LEFT JOIN companies co ON co.id = c.company_id
           GROUP BY c.id, co.slug, co.name
        ),
        meus AS (
          SELECT m.course_id,
                 COUNT(*)::int AS aulas_concluidas,
                 MAX(p.completed_at) AS ultima_aula
            FROM progress p
            JOIN lessons l ON l.id = p.lesson_id
            JOIN modules m ON m.id = l.module_id
           WHERE p.user_id = $1
           GROUP BY m.course_id
        ),
        quiz AS (
          SELECT q.course_id, MAX(qa.score)::int AS nota, BOOL_OR(qa.passed) AS aprovado
            FROM quiz_attempts qa
            JOIN quizzes q ON q.id = qa.quiz_id
           WHERE qa.user_id = $1
           GROUP BY q.course_id
        )
        SELECT c.id, c.title, c.thumbnail_url, c.is_active,
               c.company_slug, c.company_name, c.total_aulas,
               me.aulas_concluidas,
               to_char(me.ultima_aula AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS ultima_aula,
               qz.nota AS quiz_nota, qz.aprovado AS quiz_aprovado
          FROM cursos c
          JOIN meus me ON me.course_id = c.id
          LEFT JOIN quiz qz ON qz.course_id = c.id
         ORDER BY me.ultima_aula DESC
        `,
        [req.user.id],
      );

      const concluidos = [];
      const emAndamento = [];
      for (const r of result.rows) {
        const curso = {
          courseId: r.id,
          titulo: r.title,
          thumbnailUrl: r.thumbnail_url,
          empresaSlug: r.company_slug,
          empresaNome: r.company_name,
          totalAulas: r.total_aulas,
          aulasConcluidas: r.aulas_concluidas,
          ultimaAula: r.ultima_aula,
          quiz: r.quiz_nota == null ? null : { nota: r.quiz_nota, aprovado: r.quiz_aprovado },
        };
        if (r.aulas_concluidas >= r.total_aulas) concluidos.push(curso);
        // Curso desativado some do catálogo: não dá para continuar, então só
        // aparece aqui se já tiver sido concluído.
        else if (r.is_active) emAndamento.push(curso);
      }

      res.json({ concluidos, emAndamento });
    } catch (err) {
      console.error("Erro ao buscar certificados do usuário:", err);
      res.status(500).json({ error: "Erro ao buscar certificados." });
    }
  });

  return router;
};
