-- 0006_add_created_by_notices.sql
-- Registra quem criou cada aviso para exibir o autor no mural

ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;