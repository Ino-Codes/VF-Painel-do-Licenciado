-- Visibilidade de conteúdo passa a ser controlada pela EMPRESA.
-- Cria a empresa V-PARTNER (licenciados), move o conteúdo antes visível a
-- licenciados para ela, e remove o campo `visibility` de todas as tabelas.
-- Idempotente. ATENÇÃO: o DROP COLUMN apaga o campo `visibility` em PROD.

-- 1) Nova empresa V-PARTNER (id fixo 6, seguindo o padrão do baseline).
INSERT INTO companies (id, name, slug, primary_color)
VALUES (6, 'V-PARTNER', 'v-partner', '#0e7490')
ON CONFLICT (id) DO NOTHING;

-- 2) Formaliza company_id onde a coluna só existia em PROD (no-op se já houver).
ALTER TABLE files   ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE videos  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;

-- 3) Move para a V-PARTNER o conteúdo que era exclusivo de licenciados.
UPDATE files         SET company_id = 6 WHERE visibility = 'licenciados';
UPDATE videos        SET company_id = 6 WHERE visibility = 'licenciados';
UPDATE faq           SET company_id = 6 WHERE visibility = 'licenciados';
UPDATE courses       SET company_id = 6 WHERE visibility = 'licenciados';
UPDATE social_posts  SET company_id = 6 WHERE visibility = 'licenciados';
UPDATE archives      SET company_id = 6 WHERE visibility = 'licenciados';
UPDATE notices       SET company_id = 6 WHERE visibility = 'licenciados';

-- 4) Remove o campo visibility (em notices, remove junto a CHECK constraint).
ALTER TABLE files        DROP COLUMN IF EXISTS visibility;
ALTER TABLE videos       DROP COLUMN IF EXISTS visibility;
ALTER TABLE faq          DROP COLUMN IF EXISTS visibility;
ALTER TABLE courses      DROP COLUMN IF EXISTS visibility;
ALTER TABLE social_posts DROP COLUMN IF EXISTS visibility;
ALTER TABLE archives     DROP COLUMN IF EXISTS visibility;
ALTER TABLE notices      DROP COLUMN IF EXISTS visibility;
