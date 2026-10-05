-- 0045_create_it_assets.sql
-- Inventário de TI: notebooks, celulares e o que vier depois.
--
-- Três tabelas:
--   it_asset_types   — cadastro de tipos. A categoria decide quais campos
--                      específicos a tela mostra (admin local p/ computador,
--                      IMEI p/ móvel), então um tipo novo não exige código.
--   it_assets        — o ativo e a situação ATUAL (status + responsável).
--   it_asset_events  — histórico. O status só muda por ação, e toda ação
--                      grava um evento aqui.
--
-- Responsável: uma pessoa (user_id) OU um setor (setor_id, aparelho
-- compartilhado), nunca os dois. Com pessoa, setor e unidade exibidos vêm do
-- cadastro do colaborador — não se duplicam no ativo.
--
-- Usuários são excluídos com DELETE definitivo, por isso:
--   • it_assets.user_id é RESTRICT: não se exclui quem ainda tem equipamento
--     (a rota de exclusão devolve uma mensagem amigável antes disso);
--   • os eventos guardam os NOMES, e o histórico sobrevive à exclusão.
--
-- Idempotente: o banco de desenvolvimento é o de produção.

CREATE TABLE IF NOT EXISTS it_asset_types (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  categoria TEXT NOT NULL DEFAULT 'outro'
    CHECK (categoria IN ('computador', 'movel', 'outro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO it_asset_types (nome, categoria) VALUES
  ('Notebook', 'computador'),
  ('Celular', 'movel')
ON CONFLICT (nome) DO NOTHING;

CREATE TABLE IF NOT EXISTS it_assets (
  id SERIAL PRIMARY KEY,
  type_id INTEGER NOT NULL REFERENCES it_asset_types(id),
  patrimonio TEXT,
  marca TEXT,
  modelo TEXT,
  numero_serie TEXT,
  admin_local BOOLEAN,

  status TEXT NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel', 'em_uso', 'manutencao', 'baixado')),
  user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  setor_id INTEGER REFERENCES setores(id) ON DELETE SET NULL,
  unidade_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  -- Desde quando está com o responsável atual (data da entrega).
  responsavel_desde DATE,

  data_aquisicao DATE,
  valor_aquisicao NUMERIC(12, 2),
  fornecedor TEXT,
  nota_fiscal TEXT,
  garantia_ate DATE,

  observacao TEXT,
  -- 'planilha' nos importados da planilha do Google; NULL nos cadastrados
  -- pela tela.
  origem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT it_assets_um_responsavel
    CHECK (user_id IS NULL OR setor_id IS NULL),
  CONSTRAINT it_assets_em_uso_tem_responsavel
    CHECK (status <> 'em_uso' OR user_id IS NOT NULL OR setor_id IS NOT NULL),
  CONSTRAINT it_assets_livre_sem_responsavel
    CHECK (status NOT IN ('disponivel', 'baixado')
           OR (user_id IS NULL AND setor_id IS NULL))
);

-- Patrimônio é opcional ("sem patrimônio"), mas único quando informado.
CREATE UNIQUE INDEX IF NOT EXISTS ux_it_assets_patrimonio
  ON it_assets (patrimonio) WHERE patrimonio IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_it_assets_user ON it_assets (user_id);
CREATE INDEX IF NOT EXISTS ix_it_assets_status ON it_assets (status);

CREATE TABLE IF NOT EXISTS it_asset_events (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES it_assets(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('cadastro', 'edicao', 'entrega', 'devolucao',
                    'transferencia', 'manutencao', 'retorno', 'baixa')),
  -- Colaborador envolvido (quem recebeu / devolveu). Nome gravado à parte
  -- porque o usuário pode ser excluído depois.
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  colaborador_nome TEXT,
  setor_id INTEGER REFERENCES setores(id) ON DELETE SET NULL,
  setor_nome TEXT,
  detalhes TEXT,
  -- Data informada na ação (a entrega pode ser registrada no dia seguinte).
  data_evento DATE NOT NULL DEFAULT CURRENT_DATE,
  feito_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
  feito_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_it_asset_events_asset
  ON it_asset_events (asset_id, created_at);

-- Permissões da tela para o grupo Administrador. O seedGroups só concede o
-- preset a grupos sem nenhuma permissão, então grupos existentes não recebem
-- chaves novas sozinhos. Em banco novo o grupo ainda não existe aqui e o
-- próprio seed concede tudo depois.
INSERT INTO group_permissions (group_id, permission_key)
SELECT g.id, k.chave
  FROM user_groups g
 CROSS JOIN (VALUES ('it_assets.view'), ('it_assets.manage')) AS k(chave)
 WHERE g.slug = 'administrador'
ON CONFLICT DO NOTHING;
