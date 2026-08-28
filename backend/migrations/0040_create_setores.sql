-- migrations/0040_create_setores.sql
-- Normaliza os setores: cria a tabela `setores`, vincula users.setor_id e faz
-- backfill a partir do campo de texto users.setor (que é mantido por ora).
-- Idempotente (seguro rodar mais de uma vez).

-- 1) Tabela de setores.
CREATE TABLE IF NOT EXISTS setores (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Popula os setores a partir dos valores distintos já existentes em users.
--    (Mantém eventuais grafias divergentes como registros separados — a limpeza
--     fica a cargo do admin, agora que há uma tabela para isso.)
INSERT INTO setores (nome)
SELECT DISTINCT TRIM(setor)
FROM users
WHERE setor IS NOT NULL AND TRIM(setor) <> ''
ON CONFLICT (nome) DO NOTHING;

-- 3) Vincula o setor por id na tabela de usuários.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS setor_id INTEGER REFERENCES setores(id) ON DELETE SET NULL;

-- 4) Backfill do vínculo, casando pelo nome (apenas onde ainda está nulo).
UPDATE users u
SET setor_id = s.id
FROM setores s
WHERE u.setor_id IS NULL
  AND u.setor IS NOT NULL
  AND TRIM(u.setor) = s.nome;
