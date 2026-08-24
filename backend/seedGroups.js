// ───────────────────────────────────────────────────────────────────────────
// Semeadura idempotente dos grupos-padrão do RBAC.
//
// Chamado no boot, depois das migrações. Seguro rodar quantas vezes for:
//   - cria os grupos de sistema que faltarem (por slug);
//   - concede os grants do preset APENAS a grupos de sistema que estejam sem
//     nenhuma permissão (não sobrescreve customizações feitas pelo admin);
//   - faz backfill de users.group_id a partir do role legado, só onde nulo.
// ───────────────────────────────────────────────────────────────────────────

const { SYSTEM_GROUPS, ROLE_TO_SLUG } = require("./permissions.js");

async function seedGroups(pool) {
  // Slugs de grupos de sistema que o admin excluiu — o seed não deve recriá-los.
  const deletedRes = await pool.query(
    "SELECT slug FROM deleted_system_groups",
  );
  const deletedSlugs = new Set(deletedRes.rows.map((r) => r.slug));

  // 1) Garante a existência dos grupos de sistema (exceto os excluídos).
  for (const [slug, def] of Object.entries(SYSTEM_GROUPS)) {
    if (deletedSlugs.has(slug)) continue;
    await pool.query(
      `INSERT INTO user_groups (name, slug, description, is_system)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (slug) DO NOTHING`,
      [def.name, slug, def.description],
    );
  }

  // 2) Concede o preset a grupos de sistema ainda sem permissões.
  for (const [slug, def] of Object.entries(SYSTEM_GROUPS)) {
    if (deletedSlugs.has(slug)) continue;
    const groupRes = await pool.query(
      "SELECT id FROM user_groups WHERE slug = $1",
      [slug],
    );
    if (groupRes.rows.length === 0) continue;
    const groupId = groupRes.rows[0].id;

    const countRes = await pool.query(
      "SELECT COUNT(*)::int AS c FROM group_permissions WHERE group_id = $1",
      [groupId],
    );
    if (countRes.rows[0].c > 0) continue; // já tem grants — respeita o admin

    for (const key of def.permissions) {
      await pool.query(
        `INSERT INTO group_permissions (group_id, permission_key)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [groupId, key],
      );
    }
  }

  // 3) Backfill: associa cada usuário sem grupo ao grupo do seu role legado
  //    (pula slugs cujo grupo de sistema foi excluído — não recria vínculo).
  for (const [role, slug] of Object.entries(ROLE_TO_SLUG)) {
    if (deletedSlugs.has(slug)) continue;
    await pool.query(
      `UPDATE users
         SET group_id = (SELECT id FROM user_groups WHERE slug = $1)
       WHERE group_id IS NULL AND role = $2`,
      [slug, role],
    );
  }
}

module.exports = { seedGroups };
