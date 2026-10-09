-- 0048_user_certificates.sql
-- Certificados e diplomas de outras organizações, cadastrados pelo próprio
-- colaborador no Perfil. Cada certificado tem um ou mais arquivos (imagem ou
-- PDF): imagens ficam no Cloudinary e PDFs no Azure Blob, como o resto dos
-- documentos do Painel (storage/documentos.js).
--
-- Idempotente: o banco de desenvolvimento é o de produção.

CREATE TABLE IF NOT EXISTS user_certificates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  organizacao TEXT NOT NULL,
  -- Mês de emissão: sempre o dia 1º do mês (só mês e ano importam).
  data_emissao DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_user_certificates_user
  ON user_certificates (user_id, data_emissao DESC);

CREATE TABLE IF NOT EXISTS user_certificate_files (
  id SERIAL PRIMARY KEY,
  certificate_id INTEGER NOT NULL REFERENCES user_certificates(id) ON DELETE CASCADE,
  -- Onde o arquivo está: 'cloudinary' (url + public_id) ou 'azure' (blob_name).
  storage TEXT NOT NULL CHECK (storage IN ('cloudinary', 'azure')),
  url TEXT,
  public_id TEXT,
  blob_name TEXT,
  nome_original TEXT NOT NULL,
  content_type TEXT NOT NULL,
  tamanho INTEGER NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_user_certificate_files_cert
  ON user_certificate_files (certificate_id, ordem, id);
