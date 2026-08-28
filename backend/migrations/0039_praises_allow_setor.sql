-- migrations/0039_praises_allow_setor.sql
-- Elogios agora podem ser direcionados a uma PESSOA (recipient_id) OU a um
-- SETOR (recipient_setor). Torna recipient_id opcional e adiciona a coluna de
-- setor. Idempotente (seguro rodar mesmo se a 0038 já tiver criado a tabela).

ALTER TABLE praises ALTER COLUMN recipient_id DROP NOT NULL;
ALTER TABLE praises ADD COLUMN IF NOT EXISTS recipient_setor TEXT;
