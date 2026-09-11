-- 0043_whatsapp_link_and_attachments.sql
-- Amplia a sessão do bot de WhatsApp para dois fluxos novos:
--
-- 1) Vínculo do telefone por e-mail + código: quando o número não é
--    reconhecido, o bot pede o e-mail corporativo e envia um código de 6
--    dígitos. Guardamos apenas o HASH do código (nunca o código em claro),
--    com validade e contador de tentativas.
--
-- 2) Anexos: arquivos enviados na conversa vão para o Cloudinary na hora e
--    ficam aqui como rascunho (JSONB) até o chamado ser criado.

ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS link_email TEXT,
  ADD COLUMN IF NOT EXISTS link_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS link_code_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS link_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
