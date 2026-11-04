-- 0050_ticket_classificacao_atendente.sql
-- A classificação do chamado passa a ser do ATENDENTE, não do solicitante:
-- muita gente marcava "bug" só para ser atendida antes, o que distorcia os
-- indicadores. O chamado nasce sem tipo (NULL) e o atendente classifica ao
-- iniciar o atendimento; pode reclassificar até concluir.
--
-- Tipos do atendente: bug, duvida, solicitacao, melhoria, acesso.
-- Tipos antigos (escolhidos pelo solicitante) continuam válidos só para o
-- histórico: help (Ajuda) e suggestion (Sugestão).
--
-- classified_at / classified_by separam o que o atendente classificou do que
-- veio do solicitante — os indicadores por tipo usam só o primeiro.
--
-- Idempotente: o banco de desenvolvimento é o de produção.

ALTER TABLE tickets ALTER COLUMN type DROP DEFAULT;
ALTER TABLE tickets ALTER COLUMN type DROP NOT NULL;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ;
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS classified_by INTEGER
    REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS classified_by_name TEXT;

-- Chamados que ainda não começaram a ser atendidos perdem o tipo escolhido
-- pelo solicitante: quem classifica é o atendente, ao iniciar.
UPDATE tickets SET type = NULL WHERE status = 'novo' AND classified_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tickets_type_check'
  ) THEN
    ALTER TABLE tickets ADD CONSTRAINT tickets_type_check CHECK (
      type IN ('bug', 'duvida', 'solicitacao', 'melhoria', 'acesso',
               'help', 'suggestion')
    );
  END IF;

  -- Fora da etapa "novo" todo chamado tem tipo: iniciar o atendimento exige
  -- a classificação.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tickets_type_fora_do_novo'
  ) THEN
    ALTER TABLE tickets ADD CONSTRAINT tickets_type_fora_do_novo CHECK (
      status = 'novo' OR type IS NOT NULL
    );
  END IF;
END $$;
