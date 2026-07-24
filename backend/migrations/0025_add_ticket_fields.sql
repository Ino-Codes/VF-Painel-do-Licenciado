-- 0025_add_ticket_fields.sql
-- Campos para o controle de atendimento de chamados (item 2 do roadmap):
--   • requester_email  → e-mail do solicitante (confirmação de abertura e conclusão)
--   • observation      → campo "Observação" (anotações internas)
-- Idempotente: no-op em produção, cria em banco novo. Colunas NULLABLE para
-- não quebrar os tickets já existentes.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS requester_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS observation     TEXT;
