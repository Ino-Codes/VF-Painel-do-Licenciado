// backend/whatsappSender.js
// Cliente de envio de mensagens no WhatsApp via Zenvia, compartilhado pelo bot
// de atendimento (routes/whatsapp.js) e pelas notificações de chamado
// (routes/tickets.js).
//
// ⚠️ Janela de 24 horas: o WhatsApp só aceita mensagem livre (texto/botões)
// dentro de 24h desde a última mensagem do usuário. Fora dessa janela apenas
// TEMPLATES aprovados pela Meta são entregues — por isso as notificações que
// partem da empresa (ex.: conclusão de chamado) devem usar `sendTemplate`.
//
// Variáveis de ambiente:
//   ZENVIA_API_TOKEN → X-API-Token da Zenvia
//   ZENVIA_FROM      → número remetente conectado na Zenvia (só dígitos)

const ZENVIA_API_URL = "https://api.zenvia.com/v2/channels/whatsapp/messages";

const isConfigured = () =>
  Boolean(process.env.ZENVIA_API_TOKEN && process.env.ZENVIA_FROM);

// Normaliza um telefone brasileiro para o formato que a Zenvia espera
// (internacional, só dígitos: 55 + DDD + número). Devolve null se não parecer
// um número válido.
const toZenviaNumber = (telefone) => {
  const digits = String(telefone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
};

const sendContents = async (to, contents) => {
  const token = process.env.ZENVIA_API_TOKEN;
  const from = process.env.ZENVIA_FROM;
  if (!token || !from) {
    console.warn(
      "[whatsapp] ZENVIA_API_TOKEN/ZENVIA_FROM ausentes — mensagem não enviada.",
    );
    return false;
  }
  if (!to) {
    console.warn("[whatsapp] destinatário ausente — mensagem não enviada.");
    return false;
  }

  try {
    const response = await fetch(ZENVIA_API_URL, {
      method: "POST",
      headers: {
        "X-API-TOKEN": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, contents }),
    });
    if (!response.ok) {
      console.error(
        "[whatsapp] Falha ao enviar mensagem:",
        response.status,
        await response.text(),
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[whatsapp] Erro ao enviar mensagem:", err);
    return false;
  }
};

const sendText = (to, text) => sendContents(to, [{ type: "text", text }]);

// Botões de resposta rápida. Se a Zenvia recusar o conteúdo interativo, cai
// para uma lista numerada em texto — quem consome trata as duas formas.
const sendButtons = async (to, body, buttons) => {
  const ok = await sendContents(to, [{ type: "button", body, buttons }]);
  if (ok) return true;

  const numbered = buttons.map((b, i) => `${i + 1}. ${b.title}`).join("\n");
  return sendText(to, `${body}\n\n${numbered}\n\nResponda com o número.`);
};

// Variáveis de template do WhatsApp não aceitam quebra de linha nem texto
// muito longo, então cada valor é achatado e truncado.
const TEMPLATE_FIELD_MAX = 600;

const sanitizeTemplateField = (value, fallback = "-") => {
  const flat = String(value ?? "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!flat) return fallback;
  return flat.length > TEMPLATE_FIELD_MAX
    ? `${flat.slice(0, TEMPLATE_FIELD_MAX - 1)}…`
    : flat;
};

const sendTemplate = (to, templateId, fields = {}) => {
  const safeFields = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, sanitizeTemplateField(v)]),
  );
  return sendContents(to, [
    { type: "template", templateId, fields: safeFields },
  ]);
};

module.exports = {
  isConfigured,
  toZenviaNumber,
  sendContents,
  sendText,
  sendButtons,
  sendTemplate,
  sanitizeTemplateField,
};
