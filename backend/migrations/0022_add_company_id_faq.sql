-- 0022_add_company_id_faq.sql
-- Adiciona company_id à tabela faq (coluna estava ausente nas migrations anteriores)

ALTER TABLE faq
  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;

-- Garante que registros existentes sem company_id sejam atribuídos à empresa 1 (V-TAX)
UPDATE faq SET company_id = 1 WHERE company_id IS NULL;

-- Torna a coluna obrigatória daqui em diante com default para empresa 1
ALTER TABLE faq ALTER COLUMN company_id SET DEFAULT 1;
ALTER TABLE faq ALTER COLUMN company_id SET NOT NULL;
