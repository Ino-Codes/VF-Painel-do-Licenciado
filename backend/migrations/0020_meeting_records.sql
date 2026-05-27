-- Tabela principal de atas de reunião
CREATE TABLE IF NOT EXISTS meeting_records (
  id              SERIAL PRIMARY KEY,
  title           TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  creator_id      INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  creator_name    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Participantes da reunião (relação N:N com users)
CREATE TABLE IF NOT EXISTS meeting_participants (
  meeting_id  INTEGER NOT NULL REFERENCES meeting_records(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name   TEXT,
  PRIMARY KEY (meeting_id, user_id)
);

-- Arquivos anexados à reunião
CREATE TABLE IF NOT EXISTS meeting_attachments (
  id          SERIAL PRIMARY KEY,
  meeting_id  INTEGER NOT NULL REFERENCES meeting_records(id) ON DELETE CASCADE,
  file_name   TEXT    NOT NULL,
  file_url    TEXT    NOT NULL,
  file_type   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_meeting_records_creator   ON meeting_records(creator_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON meeting_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attachments_meeting ON meeting_attachments(meeting_id);