-- PASSO 1: Remove o constraint antigo (se existir)
ALTER TABLE notices
  DROP CONSTRAINT IF EXISTS notices_visibility_check;

-- PASSO 2: Migra os dados ANTES de criar o novo constraint
UPDATE notices SET visibility = 'licenciado' WHERE visibility = 'licenciados';
UPDATE notices SET visibility = 'todos'      WHERE visibility = 'internos';
UPDATE notices SET visibility = 'todos'      WHERE visibility = 'colaboradores';

-- PASSO 3: Só agora adiciona o constraint com os dados já corretos
ALTER TABLE notices
  ADD CONSTRAINT notices_visibility_check
  CHECK (visibility IN ('todos', 'admin', 'rh', 'comercial', 'operacional', 'licenciado'));