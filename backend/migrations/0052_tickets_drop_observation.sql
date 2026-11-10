-- 0052_tickets_drop_observation.sql
-- Remove o campo único de observação dos chamados. Ele foi substituído pelos
-- comentários da linha do tempo (ticket_activity), e a 0051 já copiou cada
-- observação existente como o primeiro comentário do chamado ("Observação
-- anterior") — migração conferida antes desta remoção.
--
-- Idempotente: o banco de desenvolvimento é o de produção.

ALTER TABLE tickets DROP COLUMN IF EXISTS observation;
