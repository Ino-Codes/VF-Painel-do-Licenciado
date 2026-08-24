-- Renomeia o grupo de sistema "Licenciado" para "V-Partner" (apenas o nome
-- exibido; o slug 'licenciado' permanece como identificador interno do RBAC,
-- do role legado e do controle de acesso por empresa V-PARTNER).
-- O seedGroups.js não atualiza o nome de grupos já existentes (ON CONFLICT DO
-- NOTHING), por isso a atualização do registro em produção é feita aqui.
-- Idempotente.

UPDATE user_groups SET name = 'V-Partner' WHERE slug = 'licenciado';
