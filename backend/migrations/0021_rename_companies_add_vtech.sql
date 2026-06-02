-- 0021_rename_companies_add_vtech.sql
-- Renomeia os slugs e nomes das empresas existentes e adiciona a empresa V-TECH

UPDATE companies SET slug = 'v-tax',     name = 'V-TAX'     WHERE id = 1;
UPDATE companies SET slug = 'v-banking', name = 'V-BANKING' WHERE id = 2;
UPDATE companies SET slug = 'v-business',name = 'V-BUSINESS' WHERE id = 3;
UPDATE companies SET slug = 'v-corp',    name = 'V-CORP'    WHERE id = 4;

INSERT INTO companies (id, name, slug)
VALUES (5, 'V-TECH', 'v-tech')
ON CONFLICT (id) DO NOTHING;
