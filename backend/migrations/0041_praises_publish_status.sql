-- 0041_praises_publish_status.sql
-- Modelo rascunho → publicação em lote para o Mural de Elogios.
--
-- published_at:
--   NULL          → rascunho (apenas o curador vê, na apuração da urna)
--   preenchido    → publicado (visível aos destinatários: Quem Somos e Perfil)
--
-- Backfill: elogios já existentes (anteriores a este modelo) contam como
-- publicados (published_at = created_at), para não sumirem das novas visões.

ALTER TABLE praises ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE praises SET published_at = created_at WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_praises_published_at ON praises (published_at);
