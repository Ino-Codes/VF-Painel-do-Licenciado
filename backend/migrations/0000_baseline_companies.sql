-- 0000_baseline_companies.sql
-- Reconstrói schema legado criado ANTES da adoção do sistema de migrations.
--
-- Colunas idênticas à produção (conferidas via DBeaver em 2026-07-16).
-- A tabela `companies` já existe em produção; aqui ela é registrada de forma
-- IDEMPOTENTE (CREATE IF NOT EXISTS + INSERT ON CONFLICT), ou seja:
--   • Em produção: no-op seguro (a tabela e as linhas já existem).
--   • Em banco novo (fresh): cria e popula do zero.
--
-- Numerada como 0000 DE PROPÓSITO: precisa rodar ANTES da migration 0005,
-- que é a primeira a referenciar companies(id) via FOREIGN KEY.
--
-- Obs.: `slug` recebe UNIQUE porque o código o usa como chave natural
-- (SELECT id FROM companies WHERE slug = $1). Em produção o CREATE é ignorado,
-- então isso só afeta bancos novos.

CREATE TABLE IF NOT EXISTS companies (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(50)  NOT NULL UNIQUE,
  primary_color VARCHAR(20),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Empresas do grupo (ids fixos — usados como referência em todo o sistema).
-- Novas empresas devem ser inseridas com id explícito, seguindo este padrão.
INSERT INTO companies (id, name, slug) VALUES
  (1, 'V-TAX',      'v-tax'),
  (2, 'V-BANKING',  'v-banking'),
  (3, 'V-BUSINESS', 'v-business'),
  (4, 'V-CORP',     'v-corp'),
  (5, 'V-TECH',     'v-tech')
ON CONFLICT (id) DO NOTHING;
