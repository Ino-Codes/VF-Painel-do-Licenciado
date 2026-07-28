-- 0027_create_ticket_status_history.sql
-- Histórico de movimentação dos tickets: registra CADA transição de status.
-- É a base para os indicadores de atendimento (tempo médio de conclusão, tempo
-- até o primeiro atendimento, volume por etapa, reaberturas, etc.).
-- Idempotente: no-op em banco que já tenha rodado; cria em banco novo.

CREATE TABLE IF NOT EXISTS ticket_status_history (
  id              SERIAL PRIMARY KEY,
  ticket_id       INTEGER      NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_status     VARCHAR(50),               -- NULL no evento de criação
  to_status       VARCHAR(50)  NOT NULL,
  changed_by      INTEGER      REFERENCES users(id) ON DELETE SET NULL, -- NULL = solicitante/widget
  changed_by_name TEXT,                      -- nome desnormalizado (histórico legível)
  changed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tsh_ticket_id ON ticket_status_history (ticket_id);
CREATE INDEX IF NOT EXISTS idx_tsh_to_status ON ticket_status_history (to_status);
CREATE INDEX IF NOT EXISTS idx_tsh_changed_at ON ticket_status_history (changed_at);

-- Backfill do marco de ABERTURA dos tickets já existentes, usando o created_at
-- real de cada um. NÃO fabrica transições intermediárias (essas se perderam) —
-- apenas garante que todo ticket tenha ao menos o evento de criação, para as
-- métricas de volume/data serem completas desde o histórico.
INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_at)
SELECT t.id, NULL, 'novo', t.created_at
FROM tickets t
WHERE NOT EXISTS (
  SELECT 1 FROM ticket_status_history h WHERE h.ticket_id = t.id
);
