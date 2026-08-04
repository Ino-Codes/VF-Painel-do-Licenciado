-- 0028_add_two_factor_to_users.sql
-- Verificação em duas etapas (2FA) no login: código enviado por e-mail, com
-- validade de 2 minutos. Armazenamos o código com hash (SHA-256), a expiração
-- e um contador de tentativas (para travar força-bruta). Idempotente.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_code     VARCHAR(64),
  ADD COLUMN IF NOT EXISTS two_factor_expires  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS two_factor_attempts INTEGER NOT NULL DEFAULT 0;
