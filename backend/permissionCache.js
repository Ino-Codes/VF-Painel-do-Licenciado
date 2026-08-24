// ───────────────────────────────────────────────────────────────────────────
// Cache em memória das permissões por grupo.
//
// Resolve group_id → Set(permission_keys) a partir de group_permissions, com
// TTL curto. A invalidação explícita (chamada nos writes de grupo) dá efeito
// imediato na mesma instância; o TTL cobre eventuais múltiplas instâncias.
// ───────────────────────────────────────────────────────────────────────────

const { ROLE_TO_SLUG } = require("./permissions.js");

const TTL_MS = 60000; // 60s

// group_id → { at: epochMs, keys: string[] }
const cache = new Map();
// slug → { at: epochMs, groupId: number|null }
const slugCache = new Map();

async function getGroupPermissions(pool, groupId) {
  if (groupId === null || groupId === undefined) return [];

  const cached = cache.get(groupId);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.keys;
  }

  const result = await pool.query(
    "SELECT permission_key FROM group_permissions WHERE group_id = $1",
    [groupId],
  );
  const keys = result.rows.map((r) => r.permission_key);
  cache.set(groupId, { at: Date.now(), keys });
  return keys;
}

async function getGroupIdBySlug(pool, slug) {
  if (!slug) return null;
  const cached = slugCache.get(slug);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.groupId;
  }
  const res = await pool.query(
    "SELECT id FROM user_groups WHERE slug = $1",
    [slug],
  );
  const groupId = res.rows.length ? res.rows[0].id : null;
  slugCache.set(slug, { at: Date.now(), groupId });
  return groupId;
}

// Resolve as permissões efetivas de um usuário a partir do payload do JWT.
// Prioriza group_id; se ausente (tokens antigos na transição), cai para o
// grupo correspondente ao role legado.
async function resolvePermissions(pool, jwtUser) {
  if (!pool || !jwtUser) return [];
  let groupId = jwtUser.group_id;
  if (groupId === undefined || groupId === null) {
    const slug = ROLE_TO_SLUG[jwtUser.role];
    groupId = await getGroupIdBySlug(pool, slug);
  }
  return getGroupPermissions(pool, groupId);
}

// Limpa o cache: um grupo específico ou todos (sem argumento).
function invalidateGroupCache(groupId) {
  if (groupId === undefined || groupId === null) {
    cache.clear();
  } else {
    cache.delete(groupId);
  }
  slugCache.clear();
}

module.exports = {
  getGroupPermissions,
  getGroupIdBySlug,
  resolvePermissions,
  invalidateGroupCache,
};
