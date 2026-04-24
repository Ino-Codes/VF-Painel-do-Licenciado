-- Adiciona coluna de visibilidade nos posts sociais
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'all';

-- Valores possíveis: 'all' | 'internal' | 'external'