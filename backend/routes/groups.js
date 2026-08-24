const express = require("express");
const router = express.Router();

const { isLoggedIn, checkPermission } = require("../middleware/auth.js");
const { invalidateGroupCache } = require("../permissionCache.js");
const {
  getPermissionCatalog,
  isValidPermissionKey,
  PROTECTED_GROUP_SLUGS,
} = require("../permissions.js");

// Gera um slug a partir do nome (kebab-case, sem acentos).
function slugify(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = function (pool, logActivity) {
  // ── GET / — lista os grupos com permissões e nº de membros ────────────────
  router.get(
    "/",
    isLoggedIn,
    checkPermission("groups.view"),
    async (req, res) => {
      try {
        const result = await pool.query(
          `SELECT g.id, g.name, g.slug, g.description, g.is_system,
             COALESCE(
               array_agg(gp.permission_key) FILTER (WHERE gp.permission_key IS NOT NULL),
               '{}'
             ) AS permissions,
             (SELECT COUNT(*)::int FROM users u WHERE u.group_id = g.id) AS member_count
           FROM user_groups g
           LEFT JOIN group_permissions gp ON gp.group_id = g.id
           GROUP BY g.id
           ORDER BY g.is_system DESC, g.name ASC`,
        );
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao listar grupos:", err);
        res.status(500).json({ error: "Erro ao listar grupos." });
      }
    },
  );

  // ── GET /assignable — lista enxuta p/ atribuir grupo a usuários ───────────
  // Acessível a quem gerencia usuários (não exige groups.view).
  router.get(
    "/assignable",
    isLoggedIn,
    checkPermission("users.manage"),
    async (req, res) => {
      try {
        const result = await pool.query(
          "SELECT id, name, slug, is_system FROM user_groups ORDER BY is_system DESC, name ASC",
        );
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao listar grupos atribuíveis:", err);
        res.status(500).json({ error: "Erro ao listar grupos." });
      }
    },
  );

  // ── GET /permissions-catalog — catálogo de permissões (do código) ─────────
  router.get(
    "/permissions-catalog",
    isLoggedIn,
    checkPermission("groups.view"),
    (req, res) => {
      res.json(getPermissionCatalog());
    },
  );

  // ── POST / — cria um grupo ────────────────────────────────────────────────
  router.post(
    "/",
    isLoggedIn,
    checkPermission("groups.manage"),
    async (req, res) => {
      const { name, description, permissions } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Nome é obrigatório." });
      }
      const keys = Array.isArray(permissions) ? permissions : [];
      const invalid = keys.filter((k) => !isValidPermissionKey(k));
      if (invalid.length) {
        return res
          .status(400)
          .json({ error: `Permissões inválidas: ${invalid.join(", ")}` });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Slug único (acrescenta sufixo se colidir).
        let baseSlug = slugify(name) || "grupo";
        let slug = baseSlug;
        let n = 1;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const exists = await client.query(
            "SELECT 1 FROM user_groups WHERE slug = $1",
            [slug],
          );
          if (exists.rows.length === 0) break;
          n += 1;
          slug = `${baseSlug}-${n}`;
        }

        const insert = await client.query(
          `INSERT INTO user_groups (name, slug, description, is_system)
           VALUES ($1, $2, $3, false) RETURNING id`,
          [name.trim(), slug, description || null],
        );
        const groupId = insert.rows[0].id;

        for (const key of keys) {
          await client.query(
            `INSERT INTO group_permissions (group_id, permission_key)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [groupId, key],
          );
        }

        await client.query("COMMIT");
        invalidateGroupCache(groupId);
        if (logActivity) {
          logActivity(
            req.user.id,
            req.user.email,
            "Grupo Criado",
            `Grupo "${name.trim()}" criado.`,
            req.ipAddress,
          );
        }
        res.status(201).json({ id: groupId, slug });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao criar grupo:", err);
        res.status(500).json({ error: "Erro ao criar grupo." });
      } finally {
        client.release();
      }
    },
  );

  // ── PUT /:id — atualiza nome/descrição ────────────────────────────────────
  router.put(
    "/:id",
    isLoggedIn,
    checkPermission("groups.manage"),
    async (req, res) => {
      const { id } = req.params;
      const { name, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Nome é obrigatório." });
      }
      try {
        const result = await pool.query(
          `UPDATE user_groups SET name = $1, description = $2
           WHERE id = $3 RETURNING id`,
          [name.trim(), description || null, id],
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ error: "Grupo não encontrado." });
        }
        res.json({ success: true });
      } catch (err) {
        console.error("Erro ao atualizar grupo:", err);
        res.status(500).json({ error: "Erro ao atualizar grupo." });
      }
    },
  );

  // ── PUT /:id/permissions — substitui o conjunto de permissões ─────────────
  router.put(
    "/:id/permissions",
    isLoggedIn,
    checkPermission("groups.manage"),
    async (req, res) => {
      const { id } = req.params;
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        return res
          .status(400)
          .json({ error: "Campo 'permissions' deve ser uma lista." });
      }
      const invalid = permissions.filter((k) => !isValidPermissionKey(k));
      if (invalid.length) {
        return res
          .status(400)
          .json({ error: `Permissões inválidas: ${invalid.join(", ")}` });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const grp = await client.query(
          "SELECT id FROM user_groups WHERE id = $1",
          [id],
        );
        if (grp.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Grupo não encontrado." });
        }
        await client.query(
          "DELETE FROM group_permissions WHERE group_id = $1",
          [id],
        );
        for (const key of permissions) {
          await client.query(
            `INSERT INTO group_permissions (group_id, permission_key)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [id, key],
          );
        }
        await client.query("COMMIT");
        invalidateGroupCache(Number(id));
        if (logActivity) {
          logActivity(
            req.user.id,
            req.user.email,
            "Permissões de Grupo Atualizadas",
            `Permissões do grupo #${id} atualizadas (${permissions.length}).`,
            req.ipAddress,
          );
        }
        res.json({ success: true });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao atualizar permissões do grupo:", err);
        res.status(500).json({ error: "Erro ao atualizar permissões." });
      } finally {
        client.release();
      }
    },
  );

  // ── DELETE /:id — remove um grupo (só o Administrador é protegido) ────────
  // Os usuários vinculados são desvinculados (group_id → NULL), ficando órfãos
  // de grupo. Como o FK users.group_id não tem ON DELETE SET NULL, o desvínculo
  // é feito explicitamente na mesma transação antes de remover o grupo. Se o
  // grupo for de sistema, seu slug é registrado em deleted_system_groups para o
  // seed do boot não recriá-lo.
  router.delete(
    "/:id",
    isLoggedIn,
    checkPermission("groups.manage"),
    async (req, res) => {
      const { id } = req.params;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const grp = await client.query(
          "SELECT id, name, slug, is_system FROM user_groups WHERE id = $1",
          [id],
        );
        if (grp.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Grupo não encontrado." });
        }
        if (PROTECTED_GROUP_SLUGS.includes(grp.rows[0].slug)) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: `O grupo "${grp.rows[0].name}" é protegido e não pode ser excluído.`,
          });
        }

        // Desvincula os membros (ficam órfãos de grupo).
        const orphaned = await client.query(
          "UPDATE users SET group_id = NULL WHERE group_id = $1",
          [id],
        );

        // Grupo de sistema: impede recriação no próximo boot.
        if (grp.rows[0].is_system) {
          await client.query(
            `INSERT INTO deleted_system_groups (slug)
             VALUES ($1) ON CONFLICT (slug) DO NOTHING`,
            [grp.rows[0].slug],
          );
        }

        // group_permissions tem ON DELETE CASCADE.
        await client.query("DELETE FROM user_groups WHERE id = $1", [id]);
        await client.query("COMMIT");

        invalidateGroupCache(Number(id));
        if (logActivity) {
          logActivity(
            req.user.id,
            req.user.email,
            "Grupo Excluído",
            `Grupo "${grp.rows[0].name}" excluído (${orphaned.rowCount} usuário(s) desvinculado(s)).`,
            req.ipAddress,
          );
        }
        res.json({ success: true, orphaned: orphaned.rowCount });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao excluir grupo:", err);
        res.status(500).json({ error: "Erro ao excluir grupo." });
      } finally {
        client.release();
      }
    },
  );

  return router;
};
