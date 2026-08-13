-- Ingestão de chamados por e-mail (Resend Inbound):
-- guarda o Message-ID do e-mail de origem para garantir idempotência —
-- evita criar chamados duplicados quando o webhook é reentregue.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_tickets_source_message_id
  ON tickets (source_message_id)
  WHERE source_message_id IS NOT NULL;
