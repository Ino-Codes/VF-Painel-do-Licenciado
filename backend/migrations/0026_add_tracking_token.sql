-- 0026_add_tracking_token.sql
-- Token de rastreio para o acompanhamento público de chamados (link nos e-mails
-- e consulta na página /acompanhar). Idempotente + backfill dos existentes.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(64);

UPDATE tickets
  SET tracking_token = md5(random()::text || id::text || clock_timestamp()::text)
  WHERE tracking_token IS NULL;
