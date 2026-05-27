DROP TABLE IF EXISTS help_desk_calls;

-- Tabela de tickets recebidos via widget
CREATE TABLE tickets (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER      REFERENCES widget_tenants(id) ON DELETE CASCADE,
  type        VARCHAR(50)  NOT NULL DEFAULT 'duvida', -- 'duvida', 'solicitacao', 'sugestao_melhoria', 'bug'
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  origin_url  TEXT,
  status      VARCHAR(50)  NOT NULL DEFAULT 'novo', -- novo, analise, andamento, concluido, descartado
  created_at  TIMESTAMP    DEFAULT NOW()
);