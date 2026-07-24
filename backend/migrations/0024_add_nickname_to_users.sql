-- 0024_add_nickname_to_users.sql
-- A coluna users.nickname foi criada ANTES da adoção do sistema de migrations.
-- Registrada aqui de forma IDEMPOTENTE (no-op em produção, recria em banco novo).
-- Tipo idêntico ao de produção: VARCHAR(100).
--
-- Numeração normal (forward): só precisa rodar depois da criação de `users` (0001).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
