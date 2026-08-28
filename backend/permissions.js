// ───────────────────────────────────────────────────────────────────────────
// Catálogo de permissões (RBAC) — fonte única em código.
//
// Cada "tela" navegável do sistema gera uma permissão `.view` e, quando tem
// ações de escrita, também `.manage`. Regra central do produto: toda tela e
// item de menu só aparece para quem tem o `.view` da tela.
//
// O frontend consome este catálogo via GET /api/groups/permissions-catalog.
// ───────────────────────────────────────────────────────────────────────────

// category: rótulo do agrupamento exibido na UI da tela de Grupos & Permissões.
// manage: se a tela tem ações de escrita (gera a coluna "Gerenciar").
const SCREENS = [
  // Gestão / Administração
  { key: "users", label: "Usuários", manage: true, category: "Gestão" },
  { key: "groups", label: "Grupos & Permissões", manage: true, category: "Gestão" },
  { key: "logs", label: "Logs de Atividade", manage: false, category: "Gestão" },
  { key: "analytics", label: "Estatísticas", manage: false, category: "Gestão" },
  { key: "units", label: "Unidades", manage: true, category: "Gestão" },
  { key: "projects", label: "Projetos", manage: true, category: "Gestão" },
  { key: "widget_tenants", label: "Sistemas do Helpdesk", manage: true, category: "Gestão" },
  { key: "feedbacks", label: "Feedbacks", manage: true, category: "Gestão" },

  // RH / Operacional
  { key: "meeting_records", label: "Atas de Reunião", manage: true, category: "RH & Operacional" },
  { key: "tickets", label: "Central de Chamados", manage: true, category: "RH & Operacional" },
  { key: "praises", label: "Mural de Elogios", manage: true, category: "RH & Operacional" },

  // Conteúdo
  { key: "courses", label: "Cursos", manage: true, category: "Conteúdo" },
  { key: "events", label: "Calendário", manage: true, category: "Conteúdo" },
  { key: "notices", label: "Mural de Avisos", manage: true, category: "Conteúdo" },
  { key: "files", label: "Biblioteca de Arquivos", manage: true, category: "Conteúdo" },
  { key: "archives", label: "Arquivos", manage: true, category: "Conteúdo" },
  { key: "videos", label: "Vídeos", manage: true, category: "Conteúdo" },
  { key: "social", label: "Social Media", manage: true, category: "Conteúdo" },
  { key: "faq", label: "FAQ", manage: true, category: "Conteúdo" },

  // Base (todo grupo por padrão)
  { key: "home", label: "Home", manage: false, category: "Base" },
  { key: "content_hub", label: "Conteúdos", manage: false, category: "Base" },
  { key: "profile", label: "Perfil", manage: false, category: "Base" },
  { key: "enneagram", label: "Eneagrama", manage: false, category: "Base" },
];

// Permissão-eixo, sem par view/manage: distingue acesso interno × externo nos
// poucos endpoints/telas compartilhados que ainda filtram por isso.
const STANDALONE = [
  {
    key: "internal_access",
    label: "Acesso à Área Interna",
    category: "Especial",
  },
];

// Lista achatada de todas as chaves de permissão válidas.
function allPermissionKeys() {
  const keys = [];
  for (const s of SCREENS) {
    keys.push(`${s.key}.view`);
    if (s.manage) keys.push(`${s.key}.manage`);
  }
  for (const s of STANDALONE) keys.push(s.key);
  return keys;
}

const ALL_PERMISSION_KEYS = allPermissionKeys();
const PERMISSION_KEY_SET = new Set(ALL_PERMISSION_KEYS);

function isValidPermissionKey(key) {
  return PERMISSION_KEY_SET.has(key);
}

// Catálogo estruturado para a UI: agrupado por categoria.
function getPermissionCatalog() {
  const byCategory = {};
  for (const s of SCREENS) {
    if (!byCategory[s.category]) byCategory[s.category] = [];
    byCategory[s.category].push({
      key: s.key,
      label: s.label,
      viewKey: `${s.key}.view`,
      manageKey: s.manage ? `${s.key}.manage` : null,
    });
  }
  const standalone = STANDALONE.map((s) => ({
    key: s.key,
    label: s.label,
    category: s.category,
  }));
  return { screens: byCategory, standalone };
}

// ── Presets dos grupos-padrão (espelham o acesso vigente) ──
const CONTENT_VIEW = [
  "courses.view",
  "events.view",
  "notices.view",
  "files.view",
  "archives.view",
  "videos.view",
  "social.view",
  "faq.view",
];
const CONTENT_MANAGE = CONTENT_VIEW.map((k) => k.replace(".view", ".manage"));
const BASE = ["home.view", "content_hub.view", "profile.view"];

// slug → { name, description, permissions }
const SYSTEM_GROUPS = {
  administrador: {
    name: "Administrador",
    description: "Acesso total ao sistema.",
    permissions: ALL_PERMISSION_KEYS,
  },
  rh: {
    name: "RH",
    description: "Gestão de pessoas, conteúdo e atendimento.",
    permissions: [
      ...BASE,
      "enneagram.view",
      "internal_access",
      "users.view",
      "users.manage",
      "analytics.view",
      "projects.view",
      ...CONTENT_VIEW,
      ...CONTENT_MANAGE,
      "feedbacks.view",
      "feedbacks.manage",
      "meeting_records.view",
      "meeting_records.manage",
      "tickets.view",
      "tickets.manage",
    ],
  },
  comercial: {
    name: "Comercial",
    description: "Colaborador interno — área comercial.",
    permissions: [
      ...BASE,
      "enneagram.view",
      "internal_access",
      "projects.view",
      "meeting_records.view",
      ...CONTENT_VIEW,
    ],
  },
  operacional: {
    name: "Operacional",
    description: "Colaborador interno — área operacional.",
    permissions: [
      ...BASE,
      "enneagram.view",
      "internal_access",
      "projects.view",
      "meeting_records.view",
      ...CONTENT_VIEW,
    ],
  },
  licenciado: {
    name: "V-Partner",
    description: "Parceiro externo (V-Partner). Acesso a conteúdo liberado.",
    permissions: [...BASE, ...CONTENT_VIEW],
  },
};

// Mapa role legado → slug de grupo (usado no backfill).
const ROLE_TO_SLUG = {
  admin: "administrador",
  rh: "rh",
  comercial: "comercial",
  operacional: "operacional",
  licenciado: "licenciado",
};

// Mapa inverso slug → role legado (usado ao espelhar role a partir do grupo).
const SLUG_TO_ROLE = {
  administrador: "admin",
  rh: "rh",
  comercial: "comercial",
  operacional: "operacional",
  licenciado: "licenciado",
};

// Grupos que NUNCA podem ser excluídos: o Administrador (apagá-lo trancaria o
// acesso admin de todos) e o Licenciado (é o grupo dos parceiros externos, base
// do controle de acesso por empresa V-PARTNER). Os demais grupos de sistema são
// excluíveis; quando removidos, ficam registrados em `deleted_system_groups`
// para o seed do boot não os recriar.
const PROTECTED_GROUP_SLUGS = ["administrador", "licenciado"];

module.exports = {
  SCREENS,
  STANDALONE,
  ALL_PERMISSION_KEYS,
  allPermissionKeys,
  isValidPermissionKey,
  getPermissionCatalog,
  SYSTEM_GROUPS,
  ROLE_TO_SLUG,
  SLUG_TO_ROLE,
  PROTECTED_GROUP_SLUGS,
};
