-- Atualiza a coluna visibility para usar os mesmos valores do sistema de documentos
ALTER TABLE social_posts
  ALTER COLUMN visibility SET DEFAULT 'todos';

-- Se já existirem dados com os valores antigos, migra:
UPDATE social_posts SET visibility = 'todos'       WHERE visibility = 'all';
UPDATE social_posts SET visibility = 'colaboradores' WHERE visibility = 'internal';
UPDATE social_posts SET visibility = 'licenciados'   WHERE visibility = 'external';