-- 0051_ticket_linha_do_tempo.sql
-- Linha do tempo do chamado na Central: comentários dos atendentes e eventos
-- que não são troca de status (classificação, reclassificação, atendimento
-- assumido por outra pessoa). As trocas de status continuam em
-- ticket_status_history; a linha do tempo junta as duas tabelas.
--
-- Substitui o campo único `observation`, que era salvo ao fechar o modal: o
-- último a fechar sobrescrevia o que o outro tinha escrito. Comentários só
-- se somam — não há edição nem exclusão.
--
-- Também cria a permissão especial `tickets_reassign` (assumir e excluir
-- chamados de outros atendentes), concedida só ao Administrador.
--
-- Idempotente: o banco de desenvolvimento é o de produção.

CREATE TABLE IF NOT EXISTS ticket_activity (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL
                CHECK (kind IN ('comentario', 'classificacao',
                                'reclassificacao', 'assumido')),
  body        TEXT,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id     INTEGER REFERENCES users (id) ON DELETE SET NULL,
  user_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ticket_activity_ticket
  ON ticket_activity (ticket_id, created_at);

-- Observações antigas viram o primeiro comentário do chamado. O autor não
-- era registrado; a data é a da última movimentação do chamado.
INSERT INTO ticket_activity (ticket_id, kind, body, meta, user_name, created_at)
SELECT t.id, 'comentario', t.observation,
       '{"origem": "observacao"}'::jsonb,
       NULL,
       COALESCE(
         (SELECT MAX(h.changed_at) FROM ticket_status_history h
           WHERE h.ticket_id = t.id),
         t.created_at AT TIME ZONE 'UTC'
       )
  FROM tickets t
 WHERE COALESCE(btrim(t.observation), '') <> ''
   AND NOT EXISTS (
         SELECT 1 FROM ticket_activity a
          WHERE a.ticket_id = t.id AND a.meta->>'origem' = 'observacao'
       );

-- Classificações feitas antes desta migration (0050) entram na linha do tempo.
INSERT INTO ticket_activity (ticket_id, kind, meta, user_id, user_name, created_at)
SELECT t.id, 'classificacao', jsonb_build_object('type', t.type),
       t.classified_by, t.classified_by_name, t.classified_at
  FROM tickets t
 WHERE t.classified_at IS NOT NULL
   AND NOT EXISTS (
         SELECT 1 FROM ticket_activity a
          WHERE a.ticket_id = t.id
            AND a.kind IN ('classificacao', 'reclassificacao')
       );

-- O seed não acrescenta chaves novas a grupos que já existem.
INSERT INTO group_permissions (group_id, permission_key)
SELECT g.id, 'tickets_reassign'
  FROM user_groups g
 WHERE g.slug = 'administrador'
ON CONFLICT DO NOTHING;
