-- Remove a funcionalidade de Recrutamento (entregue e nunca utilizada).
-- Descontinuada de forma definitiva: backend, frontend e banco.
-- Idempotente. ⚠️ DESTRUTIVO: apaga permanentemente os dados de recrutamento.
--
-- CASCADE cobre as FKs entre as próprias tabelas de recrutamento. As tabelas
-- compartilhadas (users, units) NÃO são tocadas — apenas as referências caem.

DROP TABLE IF EXISTS recruitment_interviews CASCADE;
DROP TABLE IF EXISTS candidate_tasks CASCADE;
DROP TABLE IF EXISTS checklist_template_items CASCADE;
DROP TABLE IF EXISTS checklist_templates CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS recruitment_stages CASCADE;

-- Remove os grants de permissão de recrutamento dos grupos (catálogo já não os expõe).
DELETE FROM group_permissions
 WHERE permission_key IN ('recruitment.view', 'recruitment.manage');
