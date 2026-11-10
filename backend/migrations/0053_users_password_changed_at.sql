-- 0053_users_password_changed_at.sql
-- Encerramento de sessões ao trocar a senha: tokens emitidos antes de
-- `password_changed_at` deixam de valer (o isLoggedIn compara com o `iat`).
-- NULL = nunca trocou desde esta migration → nenhum token é derrubado.
--
-- Índice no activity_logs: o limite de tentativas de login/redefinição conta
-- as ações recentes por tipo.
--
-- Idempotente: o banco de desenvolvimento é o de produção.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_activity_logs_action_created
  ON activity_logs (action, created_at);
