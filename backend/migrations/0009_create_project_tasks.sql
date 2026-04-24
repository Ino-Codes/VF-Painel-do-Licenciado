-- migrations/0010_create_project_tasks.sql
-- Tarefas/fases de cada projeto para o cronograma

CREATE TABLE IF NOT EXISTS project_tasks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  color TEXT DEFAULT '#d09829',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);