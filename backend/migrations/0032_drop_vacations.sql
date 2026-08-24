-- Descontinuação da funcionalidade de Férias.
-- Remove a tabela de pedidos, a coluna de saldo e as permissões órfãs.
-- Idempotente (IF EXISTS). ATENÇÃO: apaga dados de férias permanentemente.

DROP TABLE IF EXISTS vacation_requests;

ALTER TABLE users DROP COLUMN IF EXISTS saldo_ferias;

DELETE FROM group_permissions
 WHERE permission_key IN ('vacations.view', 'vacations.manage');
