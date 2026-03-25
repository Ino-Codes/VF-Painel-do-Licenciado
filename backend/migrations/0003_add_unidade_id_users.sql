-- 0003_add_unidade_id_users.sql
-- Adiciona coluna unidade_id na tabela users para vincular à tabela units

ALTER TABLE users ADD COLUMN IF NOT EXISTS unidade_id INTEGER;