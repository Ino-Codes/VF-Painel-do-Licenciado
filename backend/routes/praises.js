// backend/routes/praises.js
// Mural de Elogios — reconhecimentos entre colaboradores internos.
//
// Regras:
//   - Ver o mural: quem tem a permissão praises.view (o curador da apuração).
//   - Publicar/excluir: quem tem praises.manage.
//   - Os elogios são apurados de uma urna física (papel) e transcritos pelo
//     curador; a API NUNCA retorna o autor (author_id serve só de integridade).
//   - O destinatário (pessoa ou setor) é exibido.
const express = require("express");
const router = express.Router();
const { isLoggedIn, checkPermission } = require("../middleware/auth.js");

const MIN_LEN = 3;
const MAX_LEN = 500;

// "2026-09" -> "2026-09-01". Devolve null para qualquer outra coisa, para o
// mês nunca entrar no SQL sem passar por aqui.
const mesParaData = (valor) => {
  const texto = String(valor || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(texto)) return null;
  return `${texto}-01`;
};

module.exports = function (pool, logActivity) {
  // ─── GET /api/praises ─────────────────────────────────────────────────────
  // Lista paginada de elogios. Retorna dados do destinatário; nunca do autor.
  router.get(
    "/",
    isLoggedIn,
    checkPermission("praises.view"),
    async (req, res) => {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 24));
      const offset = (page - 1) * limit;

      // ?month=YYYY-MM restringe à competência. Um mês malformado é ignorado
      // (lista tudo) em vez de virar erro: a tela sempre tem o que mostrar.
      const mes = mesParaData(req.query.month);
      const filtro = mes ? "WHERE p.reference_month = $3" : "";

      try {
        const countRes = await pool.query(
          mes
            ? "SELECT COUNT(*)::int AS c FROM praises WHERE reference_month = $1"
            : "SELECT COUNT(*)::int AS c FROM praises",
          mes ? [mes] : [],
        );
        const totalCount = countRes.rows[0].c;
        const totalPages = Math.ceil(totalCount / limit);

        const result = await pool.query(
          `
          SELECT
            p.id,
            p.message,
            p.created_at,
            p.published_at,
            to_char(p.reference_month, 'YYYY-MM') AS reference_month,
            p.recipient_id,
            u.nome  AS recipient_name,
            u.cargo AS recipient_cargo,
            COALESCE(u.setor, p.recipient_setor) AS recipient_setor
          FROM praises p
          LEFT JOIN users u ON p.recipient_id = u.id
          ${filtro}
          ORDER BY p.reference_month DESC, p.created_at DESC
          LIMIT $1 OFFSET $2
          `,
          mes ? [limit, offset, mes] : [limit, offset],
        );

        res.json({
          praises: result.rows,
          totalCount,
          totalPages,
          currentPage: page,
          month: mes ? String(req.query.month) : null,
        });
      } catch (err) {
        console.error("Erro ao listar elogios:", err);
        res.status(500).json({ error: "Erro ao listar elogios." });
      }
    },
  );

  // ─── GET /api/praises/months ──────────────────────────────────────────────
  // Meses que têm elogios, do mais recente para o mais antigo, com as contagens
  // que alimentam o seletor de mês da apuração.
  router.get(
    "/months",
    isLoggedIn,
    checkPermission("praises.view"),
    async (req, res) => {
      try {
        const result = await pool.query(
          `
          SELECT
            to_char(reference_month, 'YYYY-MM') AS month,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE published_at IS NULL)::int AS drafts
          FROM praises
          GROUP BY reference_month
          ORDER BY reference_month DESC
          `,
        );
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao listar meses de elogios:", err);
        res.status(500).json({ error: "Erro ao listar os meses." });
      }
    },
  );

  // ─── GET /api/praises/for-user/:id ────────────────────────────────────────
  // Elogios PUBLICADOS de uma pessoa (usado no modal de Quem Somos).
  // Qualquer colaborador interno pode ver; o autor nunca é retornado.
  router.get(
    "/for-user/:id",
    isLoggedIn,
    checkPermission("internal_access"),
    async (req, res) => {
      const recipientId = parseInt(req.params.id, 10);
      if (!recipientId) {
        return res.status(400).json({ error: "Destinatário inválido." });
      }
      try {
        const result = await pool.query(
          `
          SELECT
            id,
            message,
            created_at,
            to_char(reference_month, 'YYYY-MM') AS reference_month
          FROM praises
          WHERE recipient_id = $1 AND published_at IS NOT NULL
          ORDER BY reference_month DESC, created_at DESC
          `,
          [recipientId],
        );
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao buscar elogios da pessoa:", err);
        res.status(500).json({ error: "Erro ao buscar elogios." });
      }
    },
  );

  // ─── GET /api/praises/setores ─────────────────────────────────────────────
  // Elogios PUBLICADOS direcionados a setores (seção "Elogios aos Setores").
  router.get(
    "/setores",
    isLoggedIn,
    checkPermission("internal_access"),
    async (req, res) => {
      try {
        const result = await pool.query(
          `
          SELECT
            id,
            message,
            created_at,
            recipient_setor,
            to_char(reference_month, 'YYYY-MM') AS reference_month
          FROM praises
          WHERE recipient_setor IS NOT NULL AND published_at IS NOT NULL
          ORDER BY reference_month DESC, recipient_setor ASC, created_at DESC
          `,
        );
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao buscar elogios de setores:", err);
        res.status(500).json({ error: "Erro ao buscar elogios." });
      }
    },
  );

  // ─── GET /api/praises/mine ────────────────────────────────────────────────
  // Elogios PUBLICADOS direcionados ao usuário logado ou ao seu setor.
  router.get(
    "/mine",
    isLoggedIn,
    checkPermission("internal_access"),
    async (req, res) => {
      try {
        const meRes = await pool.query(
          "SELECT setor FROM users WHERE id = $1",
          [req.user.id],
        );
        const mySetor = meRes.rows[0]?.setor || null;

        const result = await pool.query(
          `
          SELECT
            id,
            message,
            created_at,
            recipient_id,
            recipient_setor,
            to_char(reference_month, 'YYYY-MM') AS reference_month
          FROM praises
          WHERE published_at IS NOT NULL
            AND (
              recipient_id = $1
              OR ($2::text IS NOT NULL AND recipient_setor = $2)
            )
          ORDER BY reference_month DESC, created_at DESC
          `,
          [req.user.id, mySetor],
        );
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao buscar seus elogios:", err);
        res.status(500).json({ error: "Erro ao buscar seus elogios." });
      }
    },
  );

  // ─── POST /api/praises ────────────────────────────────────────────────────
  // Publica um elogio. Autor = usuário logado (gravado, mas não exposto).
  router.post(
    "/",
    isLoggedIn,
    checkPermission("praises.manage"),
    async (req, res) => {
      const authorId = req.user.id;
      const recipientId = req.body.recipientId
        ? parseInt(req.body.recipientId, 10)
        : null;
      const recipientSetor = (req.body.recipientSetor || "").trim();
      const message = (req.body.message || "").trim();
      // Sem mês no corpo, vale o DEFAULT da coluna (mês corrente).
      const referenceMonth = req.body.referenceMonth
        ? mesParaData(req.body.referenceMonth)
        : null;

      if (req.body.referenceMonth && !referenceMonth) {
        return res.status(400).json({ error: "Mês de referência inválido." });
      }

      // Exatamente um destinatário: pessoa OU setor.
      if ((!recipientId && !recipientSetor) || (recipientId && recipientSetor)) {
        return res.status(400).json({
          error: "Selecione uma pessoa ou um setor para o elogio.",
        });
      }
      // Auto-elogio é permitido: o curador transcreve elogios da urna física e
      // pode ele mesmo ser o destinatário de um deles.
      if (message.length < MIN_LEN) {
        return res.status(400).json({ error: "Escreva uma mensagem de elogio." });
      }
      if (message.length > MAX_LEN) {
        return res.status(400).json({ error: `O elogio deve ter no máximo ${MAX_LEN} caracteres.` });
      }

      try {
        if (recipientId) {
          // Destinatário pessoa: precisa ser um colaborador interno.
          const recipientRes = await pool.query(
            `
            SELECT u.id
            FROM users u
            WHERE u.id = $1
              AND EXISTS (
                SELECT 1 FROM group_permissions gp
                WHERE gp.group_id = u.group_id
                  AND gp.permission_key = 'internal_access'
              )
            `,
            [recipientId],
          );
          if (recipientRes.rows.length === 0) {
            return res.status(400).json({ error: "Destinatário inválido." });
          }
        } else {
          // Destinatário setor: precisa existir na tabela de setores.
          const setorRes = await pool.query(
            "SELECT 1 FROM setores WHERE nome = $1 LIMIT 1",
            [recipientSetor],
          );
          if (setorRes.rows.length === 0) {
            return res.status(400).json({ error: "Setor inválido." });
          }
        }

        const insert = await pool.query(
          `
          INSERT INTO praises
            (recipient_id, recipient_setor, author_id, message, reference_month)
          VALUES (
            $1, $2, $3, $4,
            COALESCE($5::date, date_trunc('month', CURRENT_DATE)::date)
          )
          RETURNING id, created_at
          `,
          [
            recipientId,
            recipientId ? null : recipientSetor,
            authorId,
            message,
            referenceMonth,
          ],
        );

        // Retorna a linha já enriquecida com o destinatário (para a UI otimista).
        const created = await pool.query(
          `
          SELECT
            p.id,
            p.message,
            p.created_at,
            p.published_at,
            to_char(p.reference_month, 'YYYY-MM') AS reference_month,
            p.recipient_id,
            u.nome  AS recipient_name,
            u.cargo AS recipient_cargo,
            COALESCE(u.setor, p.recipient_setor) AS recipient_setor
          FROM praises p
          LEFT JOIN users u ON p.recipient_id = u.id
          WHERE p.id = $1
          `,
          [insert.rows[0].id],
        );

        res.status(201).json(created.rows[0]);
      } catch (err) {
        console.error("Erro ao publicar elogio:", err);
        res.status(500).json({ error: "Erro ao publicar o elogio." });
      }
    },
  );

  // ─── POST /api/praises/publish ────────────────────────────────────────────
  // Publica em lote todos os rascunhos (published_at NULL → NOW()).
  // Usado ao final da apuração da urna, para revelar os elogios de uma vez.
  router.post(
    "/publish",
    isLoggedIn,
    checkPermission("praises.manage"),
    async (req, res) => {
      // Publicar é por competência: a apuração fecha um mês de cada vez, e
      // revelar rascunhos de outro mês por engano não tem desfazer.
      const mes = mesParaData(req.body?.month);
      if (req.body?.month && !mes) {
        return res.status(400).json({ error: "Mês de referência inválido." });
      }

      try {
        const upd = await pool.query(
          mes
            ? `UPDATE praises SET published_at = NOW()
                WHERE published_at IS NULL AND reference_month = $1
                RETURNING id`
            : `UPDATE praises SET published_at = NOW()
                WHERE published_at IS NULL
                RETURNING id`,
          mes ? [mes] : [],
        );
        const count = upd.rowCount;

        try {
          await logActivity(
            req.user.id,
            req.user.email,
            "Elogios Publicados",
            mes
              ? `${count} elogio(s) de ${req.body.month} publicado(s).`
              : `${count} elogio(s) publicado(s) em lote.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("[praises] Falha ao registrar log:", e);
        }

        res.json({ success: true, published: count });
      } catch (err) {
        console.error("Erro ao publicar elogios:", err);
        res.status(500).json({ error: "Erro ao publicar os elogios." });
      }
    },
  );

  // ─── DELETE /api/praises/:id ──────────────────────────────────────────────
  // Remove um elogio. Restrito a quem faz a apuração (praises.manage).
  router.delete(
    "/:id",
    isLoggedIn,
    checkPermission("praises.manage"),
    async (req, res) => {
      const { id } = req.params;
      try {
        const del = await pool.query(
          "DELETE FROM praises WHERE id = $1 RETURNING id",
          [id],
        );
        if (del.rowCount === 0) {
          return res.status(404).json({ error: "Elogio não encontrado." });
        }

        try {
          await logActivity(
            req.user.id,
            req.user.email,
            "Elogio Removido",
            `Elogio ID ${id} removido (moderação).`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("[praises] Falha ao registrar log:", e);
        }

        res.json({ success: true, message: "Elogio removido." });
      } catch (err) {
        console.error("Erro ao remover elogio:", err);
        res.status(500).json({ error: "Erro ao remover o elogio." });
      }
    },
  );

  return router;
};
