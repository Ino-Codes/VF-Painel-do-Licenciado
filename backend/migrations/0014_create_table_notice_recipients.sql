-- PASSO 1: Remove o constraint antigo (se existir)
ALTER TABLE notices
  DROP CONSTRAINT IF EXISTS notices_visibility_check;

-- PASSO 2: Migra TODOS os valores antigos para "todos" ANTES de criar o novo constraint
UPDATE notices
SET visibility = 'todos'
WHERE visibility NOT IN ('todos', 'selecionados');

-- PASSO 3: Cria a tabela de destinatários
CREATE TABLE IF NOT EXISTS notice_recipients (
  id        SERIAL PRIMARY KEY,
  notice_id INTEGER NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  UNIQUE (notice_id, user_id)
);

-- PASSO 4: Só agora adiciona o constraint, com os dados já corretos
ALTER TABLE notices
  ADD CONSTRAINT notices_visibility_check
  CHECK (visibility IN ('todos', 'selecionados'));