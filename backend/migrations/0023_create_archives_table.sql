-- 0023_create_archives_table.sql
-- Criação da tabela de arquivos (archives), espelhada na estrutura de files

CREATE TABLE IF NOT EXISTS archives (
  id SERIAL PRIMARY KEY,
  filename TEXT,
  originalname TEXT,
  category TEXT,
  folder TEXT,
  public_id TEXT,
  visibility TEXT DEFAULT 'todos',
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
