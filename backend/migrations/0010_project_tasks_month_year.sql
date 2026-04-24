-- 0011_project_tasks_month_year.sql
-- Adiciona colunas de mês/ano em project_tasks

ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS start_year  INTEGER,
  ADD COLUMN IF NOT EXISTS start_month INTEGER,
  ADD COLUMN IF NOT EXISTS end_year    INTEGER,
  ADD COLUMN IF NOT EXISTS end_month   INTEGER;

-- (Opcional) Se já existem dados em start_date/end_date e você quiser migrar:
UPDATE project_tasks
SET
  start_year  = EXTRACT(YEAR  FROM start_date)::INT,
  start_month = EXTRACT(MONTH FROM start_date)::INT,
  end_year    = EXTRACT(YEAR  FROM end_date)::INT,
  end_month   = EXTRACT(MONTH FROM end_date)::INT
WHERE start_date IS NOT NULL AND end_date IS NOT NULL;