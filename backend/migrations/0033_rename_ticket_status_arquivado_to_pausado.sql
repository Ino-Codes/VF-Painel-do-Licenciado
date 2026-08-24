-- Renomeia o status de chamado "arquivado" para "pausado" (etapa Pausado).
-- Atualiza os tickets e o histórico de status. Idempotente.

UPDATE tickets
   SET status = 'pausado'
 WHERE status = 'arquivado';

UPDATE ticket_status_history
   SET to_status = 'pausado'
 WHERE to_status = 'arquivado';

UPDATE ticket_status_history
   SET from_status = 'pausado'
 WHERE from_status = 'arquivado';
