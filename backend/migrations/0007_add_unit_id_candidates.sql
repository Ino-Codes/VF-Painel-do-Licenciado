-- 0007_add_unit_id_candidates.sql
-- Garante que a coluna unit_id existe em candidates (retrocompatível)

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS unit_id INTEGER;