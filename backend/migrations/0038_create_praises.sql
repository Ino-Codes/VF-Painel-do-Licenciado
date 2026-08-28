-- migrations/0038_create_praises.sql
-- Mural de Elogios: colaboradores internos publicam elogios (reconhecimentos)
-- a colegas. O autor é gravado para integridade/moderação, mas NUNCA exposto
-- publicamente (a API pública não retorna author_id). O destinatário é público.

CREATE TABLE IF NOT EXISTS praises (
  id SERIAL PRIMARY KEY,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_praises_created_at ON praises (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_praises_recipient ON praises (recipient_id);
