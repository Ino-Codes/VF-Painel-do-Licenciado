// ───────────────────────────────────────────────────────────────────────────
// Acesso a conteúdo por empresa.
//
// A visibilidade de conteúdo passou a ser controlada pela EMPRESA:
//   - licenciado (sem a permissão internal_access) → vê apenas a V-PARTNER;
//   - interno (com internal_access) → vê todas as empresas (param honrado).
// ───────────────────────────────────────────────────────────────────────────

const V_PARTNER_SLUG = "v-partner";

let cachedVpartnerId; // resolvido uma vez (slug fixo)

async function resolveVpartnerId(pool) {
  if (cachedVpartnerId !== undefined) return cachedVpartnerId;
  const res = await pool.query("SELECT id FROM companies WHERE slug = $1", [
    V_PARTNER_SLUG,
  ]);
  cachedVpartnerId = res.rows.length ? res.rows[0].id : null;
  return cachedVpartnerId;
}

// Usuário externo (licenciado) = quem NÃO tem a permissão internal_access.
function isLicenciado(req) {
  return !(
    req.user &&
    Array.isArray(req.user.permissions) &&
    req.user.permissions.includes("internal_access")
  );
}

module.exports = { V_PARTNER_SLUG, resolveVpartnerId, isLicenciado };
