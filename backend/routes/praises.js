// backend/routes/praises.js
// Mural de Elogios — reconhecimentos entre colaboradores internos.
//
// Regras:
//   - Acesso (ver + publicar): usuários com internal_access (todos menos V-Partner).
//   - Publicação é ANÔNIMA: o autor é gravado (author_id) apenas para integridade
//     e moderação; a API pública NUNCA retorna o autor.
//   - O destinatário é público.
//   - Moderação (excluir): quem tem users.manage (admin/RH).
const express = require("express");
const router = express.Router();
const { isLoggedIn, checkPermission } = require("../middleware/auth.js");

const MIN_LEN = 3;
const MAX_LEN = 500;

module.exports = function (pool, logActivity) {
  // ─── GET /api/praises ─────────────────────────────────────────────────────
  // Lista paginada de elogios. Retorna dados do destinatário; nunca do autor.
  router.get(
    "/",
    isLoggedIn,
    checkPermission("internal_access"),
    async (req, res) => {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 24));
      const offset = (page - 1) * limit;

      try {
        const countRes = await pool.query("SELECT COUNT(*)::int AS c FROM praises");
        const totalCount = countRes.rows[0].c;
        const totalPages = Math.ceil(totalCount / limit);

        const result = await pool.query(
          `
          SELECT
            p.id,
            p.message,
            p.created_at,
            p.recipient_id,
            u.nome  AS recipient_name,
            u.cargo AS recipient_cargo,
            COALESCE(u.setor, p.recipient_setor) AS recipient_setor
          FROM praises p
          LEFT JOIN users u ON p.recipient_id = u.id
          ORDER BY p.created_at DESC
          LIMIT $1 OFFSET $2
          `,
          [limit, offset],
        );

        res.json({
          praises: result.rows,
          totalCount,
          totalPages,
          currentPage: page,
        });
      } catch (err) {
        console.error("Erro ao listar elogios:", err);
        res.status(500).json({ error: "Erro ao listar elogios." });
      }
    },
  );

  // ─── POST /api/praises ────────────────────────────────────────────────────
  // Publica um elogio. Autor = usuário logado (gravado, mas não exposto).
  router.post(
    "/",
    isLoggedIn,
    checkPermission("internal_access"),
    async (req, res) => {
      const authorId = req.user.id;
      const recipientId = req.body.recipientId
        ? parseInt(req.body.recipientId, 10)
        : null;
      const recipientSetor = (req.body.recipientSetor || "").trim();
      const message = (req.body.message || "").trim();

      // Exatamente um destinatário: pessoa OU setor.
      if ((!recipientId && !recipientSetor) || (recipientId && recipientSetor)) {
        return res.status(400).json({
          error: "Selecione uma pessoa ou um setor para o elogio.",
        });
      }
      if (recipientId && recipientId === authorId) {
        return res.status(400).json({ error: "Você não pode enviar um elogio para si mesmo." });
      }
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
          INSERT INTO praises (recipient_id, recipient_setor, author_id, message)
          VALUES ($1, $2, $3, $4)
          RETURNING id, created_at
          `,
          [recipientId, recipientId ? null : recipientSetor, authorId, message],
        );

        // Retorna a linha já enriquecida com o destinatário (para a UI otimista).
        const created = await pool.query(
          `
          SELECT
            p.id,
            p.message,
            p.created_at,
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

  // ─── DELETE /api/praises/:id ──────────────────────────────────────────────
  // Moderação: remove um elogio inadequado. Restrito a users.manage (admin/RH).
  router.delete(
    "/:id",
    isLoggedIn,
    checkPermission("users.manage"),
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
