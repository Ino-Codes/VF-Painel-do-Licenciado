-- 0049_ticket_rating.sql
-- Avaliação do atendimento pelo solicitante, depois que o chamado é
-- concluído: nota de 1 a 5 estrelas e comentário opcional. Uma por chamado,
-- sem edição (rating só é gravado enquanto ainda é NULL).
--
--   rating_via  'link'   → página pública /acompanhar, pelo link com token
--                          (e-mail de conclusão e WhatsApp)
--               'painel' → Meus Chamados, com o solicitante logado
--
-- Idempotente: o banco de desenvolvimento é o de produção.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS rating SMALLINT
    CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rating_comment TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS rating_via TEXT
    CHECK (rating_via IN ('link', 'painel'));

CREATE INDEX IF NOT EXISTS ix_tickets_rated_at
  ON tickets (rated_at) WHERE rating IS NOT NULL;
