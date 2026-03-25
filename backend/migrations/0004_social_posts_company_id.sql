-- 0004_social_posts_company_id.sql
-- Migra social_posts de company_name (texto livre) para company_id (FK)

ALTER TABLE social_posts DROP COLUMN IF EXISTS company_name;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS company_id INTEGER;