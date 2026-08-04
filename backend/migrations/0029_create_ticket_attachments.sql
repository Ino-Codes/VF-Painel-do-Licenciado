-- 0029_create_ticket_attachments.sql
-- Anexos enviados na abertura do chamado (pelo widget). Cada arquivo vira uma
-- linha, apontando para a URL no Cloudinary. Idempotente.

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER      NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  file_url    TEXT         NOT NULL,
  file_name   VARCHAR(255),
  file_type   VARCHAR(100),
  uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket
  ON ticket_attachments (ticket_id);
