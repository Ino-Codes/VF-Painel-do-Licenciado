-- 0044_praises_reference_month.sql
-- Competência mensal do Mural de Elogios.
--
-- A apuração da urna é mensal, mas a transcrição costuma acontecer depois que
-- o mês virou: os elogios de março podem ser digitados em 2 de abril. Agrupar
-- por created_at jogaria esses elogios no mês errado e a contagem mensal
-- ficaria torta. Por isso o mês vem de um campo próprio (competência), que o
-- curador escolhe ao registrar.
--
-- reference_month guarda sempre o dia 1º do mês de referência.
--
-- Backfill: os elogios já existentes assumem o mês em que foram criados,
-- convertido para o fuso de São Paulo (created_at é TIMESTAMPTZ, então sem a
-- conversão os registros da madrugada cairiam no mês seguinte).

ALTER TABLE praises ADD COLUMN IF NOT EXISTS reference_month DATE;

UPDATE praises
   SET reference_month = date_trunc(
         'month',
         created_at AT TIME ZONE 'America/Sao_Paulo'
       )::date
 WHERE reference_month IS NULL;

-- Quem inserir sem informar o mês cai no mês corrente.
ALTER TABLE praises
  ALTER COLUMN reference_month
  SET DEFAULT date_trunc('month', CURRENT_DATE)::date;

-- Só depois do backfill, senão a restrição barraria as linhas antigas.
ALTER TABLE praises ALTER COLUMN reference_month SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_praises_reference_month
  ON praises (reference_month DESC);
