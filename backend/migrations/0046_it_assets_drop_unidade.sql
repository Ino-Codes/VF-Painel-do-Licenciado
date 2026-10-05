-- 0046_it_assets_drop_unidade.sql
-- Inventário de TI: a unidade não é controlada por ativo — o que importa é a
-- pessoa (ou o setor) responsável. A coluna sai da tabela.
--
-- Idempotente: o banco de desenvolvimento é o de produção.

ALTER TABLE it_assets DROP COLUMN IF EXISTS unidade_id;
