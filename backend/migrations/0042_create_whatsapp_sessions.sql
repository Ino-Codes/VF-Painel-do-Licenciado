-- 0042_create_whatsapp_sessions.sql
-- Estado da conversa do bot de WhatsApp (abertura guiada de chamados).
--
-- O webhook é sem estado: cada mensagem chega isolada, sem memória do que já
-- foi perguntado. Esta tabela guarda a etapa atual e o rascunho do chamado,
-- um registro por telefone (wa_id), removido ao concluir ou cancelar.
--
-- last_message_id protege contra reentrega: a Meta reenvia o webhook quando
-- não recebe o 200 a tempo, e sem isso a conversa avançaria duas etapas.

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  wa_id           TEXT PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  step            TEXT NOT NULL,
  ticket_type     TEXT,
  title           TEXT,
  description     TEXT,
  last_message_id TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_updated_at
  ON whatsapp_sessions (updated_at);
