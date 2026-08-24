-- RBAC: registro de grupos de SISTEMA que foram excluídos pelo admin.
-- Sem isso, o seedGroups.js do boot recriaria (por slug) qualquer grupo de
-- sistema ausente. Ao excluir um grupo de sistema, seu slug é gravado aqui e o
-- seed passa a ignorá-lo. Idempotente.

CREATE TABLE IF NOT EXISTS deleted_system_groups (
  slug TEXT PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
