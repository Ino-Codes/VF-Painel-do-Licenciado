-- Tabela de tenants (sistemas de terceiros que usam o widget)
CREATE TABLE widget_tenants (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  token      VARCHAR(64)  UNIQUE NOT NULL,
  active     BOOLEAN      DEFAULT true,
  created_by INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP    DEFAULT NOW()
);

-- Tabela de help_desks_calls recebidos via widget
CREATE TABLE help_desk_calls (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER      REFERENCES widget_tenants(id) ON DELETE CASCADE,
  type        VARCHAR(50)  NOT NULL DEFAULT 'duvida', -- 'duvida', 'solicitacao', 'sugestao_melhoria', 'bug'
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  origin_url  TEXT,
  status      VARCHAR(50)  NOT NULL DEFAULT 'novo', -- novo, analise, andamento, concluido, descartado
  created_at  TIMESTAMP    DEFAULT NOW()
);