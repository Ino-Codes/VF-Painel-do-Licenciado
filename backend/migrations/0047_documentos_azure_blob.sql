-- 0047_documentos_azure_blob.sql
-- Documentos passam a ser gravados no Azure Blob Storage (imagens continuam
-- no Cloudinary). Cada linha diz onde o arquivo está:
--   storage   'cloudinary' (todos os existentes) | 'azure'
--   blob_name caminho do blob no container (só quando storage = 'azure')
-- Download e exclusão olham `storage`, então os arquivos antigos seguem
-- funcionando pelo Cloudinary até serem migrados.
--
-- Idempotente: o banco de desenvolvimento é o de produção.

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS storage TEXT NOT NULL DEFAULT 'cloudinary'
    CHECK (storage IN ('cloudinary', 'azure'));
ALTER TABLE files ADD COLUMN IF NOT EXISTS blob_name TEXT;

ALTER TABLE archives
  ADD COLUMN IF NOT EXISTS storage TEXT NOT NULL DEFAULT 'cloudinary'
    CHECK (storage IN ('cloudinary', 'azure'));
ALTER TABLE archives ADD COLUMN IF NOT EXISTS blob_name TEXT;
