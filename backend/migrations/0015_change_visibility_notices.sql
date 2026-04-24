-- 1. Remove constraint antigo (se existir)
ALTER TABLE notices
  DROP CONSTRAINT IF EXISTS notices_visibility_check;

-- 2. Migra valores antigos para os novos ANTES de criar o constraint
UPDATE notices SET visibility = 'todos'        WHERE visibility IN ('all', 'selecionados');
UPDATE notices SET visibility = 'colaboradores' WHERE visibility IN ('internos', 'internal', 'colaborador');
UPDATE notices SET visibility = 'licenciados'   WHERE visibility IN ('licenciado', 'external');

-- 3. Cria o constraint com os três valores corretos
ALTER TABLE notices
  ADD CONSTRAINT notices_visibility_check
  CHECK (visibility IN ('todos', 'colaboradores', 'licenciados'));

-- 4. Garante que a tabela de destinatários existe
CREATE TABLE IF NOT EXISTS notice_recipients (
  id        SERIAL PRIMARY KEY,
  notice_id INTEGER NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  UNIQUE (notice_id, user_id)
);