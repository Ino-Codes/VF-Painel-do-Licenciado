-- 0005_add_company_id_notices.sql
-- Vincula avisos a empresas específicas (NULL = aviso global)

ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;