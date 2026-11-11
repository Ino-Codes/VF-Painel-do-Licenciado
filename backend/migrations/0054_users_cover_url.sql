-- 0054_users_cover_url.sql
-- Capa do perfil: imagem enviada pelo próprio usuário para a faixa do topo
-- da tela de Perfil (1584 × 396 px, o padrão do LinkedIn). NULL = faixa
-- padrão, preta com o filete dourado.
--
-- Idempotente: o banco de desenvolvimento é o de produção.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cover_url TEXT;
