-- RBAC: grupos de usuário e permissões
-- Apenas DDL (idempotente). A semeadura dos grupos-padrão, dos grants e o
-- backfill de users.group_id são feitos em código por seedGroups.js no boot
-- (idempotente), mantendo o catálogo de permissões como fonte única em JS.

CREATE TABLE IF NOT EXISTS user_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_permissions (
  group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  PRIMARY KEY (group_id, permission_key)
);

CREATE INDEX IF NOT EXISTS ix_group_permissions_group
  ON group_permissions (group_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES user_groups(id);

CREATE INDEX IF NOT EXISTS ix_users_group_id ON users (group_id);
