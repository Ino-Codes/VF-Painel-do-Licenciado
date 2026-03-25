-- 0002_seeds_iniciais.sql
-- Dados iniciais obrigatórios para o sistema funcionar

INSERT INTO units (name)
  SELECT 'Matriz' WHERE NOT EXISTS (SELECT 1 FROM units WHERE name = 'Matriz');

INSERT INTO units (name)
  SELECT 'Filial SC' WHERE NOT EXISTS (SELECT 1 FROM units WHERE name = 'Filial SC');

INSERT INTO units (name)
  SELECT 'Filial SP' WHERE NOT EXISTS (SELECT 1 FROM units WHERE name = 'Filial SP');

INSERT INTO recruitment_stages (name, stage_order, pipeline_type)
  SELECT 'Entrevista', 0, 'Recrutamento'
  WHERE NOT EXISTS (
    SELECT 1 FROM recruitment_stages WHERE name ILIKE 'entrevista'
  );

INSERT INTO checklist_templates (name, is_default)
  SELECT 'Template Padrão', true
  WHERE NOT EXISTS (
    SELECT 1 FROM checklist_templates WHERE is_default = true
  );

INSERT INTO checklist_template_items (template_id, task_name)
  SELECT t.id, v.task
  FROM (SELECT id FROM checklist_templates WHERE is_default = true LIMIT 1) t
  CROSS JOIN (VALUES ('Contato inicial'), ('Enviar teste técnico'), ('Agendar entrevista')) v(task)
  WHERE NOT EXISTS (
    SELECT 1 FROM checklist_template_items it
    JOIN checklist_templates tt ON it.template_id = tt.id
    WHERE tt.is_default = true
  );