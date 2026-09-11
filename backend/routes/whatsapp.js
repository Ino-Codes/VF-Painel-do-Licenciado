// backend/routes/whatsapp.js
// Bot de atendimento no WhatsApp — abertura guiada de chamados pelos
// colaboradores internos. O envio e o recebimento passam pela Zenvia (BSP
// oficial da Meta): falamos só com a Zenvia, e ela fala com o WhatsApp.
//
// Regras:
//   - O canal é restrito: o telefone do remetente precisa bater com o
//     `telefone` de um usuário que tenha a permissão `internal_access`.
//     Quem não é reconhecido recebe uma resposta e nada é criado.
//   - O e-mail do usuário identificado vira o `requester_email` do chamado,
//     então ele aparece automaticamente em Meus Chamados no Painel e recebe
//     os e-mails de andamento que já existem.
//   - O fluxo é guiado por etapas (tipo → assunto → descrição → confirmação),
//     com o estado em `whatsapp_sessions` (o webhook é sem estado).
//
// Variáveis de ambiente:
//   ZENVIA_API_TOKEN         → X-API-Token da Zenvia (envio de mensagens)
//   ZENVIA_FROM              → número remetente conectado na Zenvia
//                              (só dígitos, ex.: 555196354886)
//   WHATSAPP_WEBHOOK_SECRET  → segredo exigido na URL do webhook. A Zenvia
//                              NÃO assina os webhooks de entrada (o HMAC dela
//                              é para autenticar chamadas à API), então a
//                              proteção é o segredo na própria URL.
//   WHATSAPP_DEBUG           → "true" registra no log o payload recebido,
//                              útil para conferir o formato real na largada.
const express = require("express");
const crypto = require("crypto");
const { sendText, sendButtons } = require("../whatsappSender.js");
const router = express.Router();

// Conversa abandonada expira: a próxima mensagem começa um fluxo novo.
const SESSION_TTL_MINUTES = 24 * 60;

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

const TYPE_LABELS = {
  help: "Ajuda",
  bug: "Bug",
  suggestion: "Sugestão",
};

// Opções do passo "tipo", na ordem em que aparecem nos botões. O índice serve
// de atalho digitado (1, 2, 3) quando os botões não chegam renderizados.
const TYPE_OPTIONS = [
  { key: "help", title: "Ajuda" },
  { key: "bug", title: "Bug" },
  { key: "suggestion", title: "Sugestão" },
];

const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://painel.vcorporate.com.br";

const firstName = (nome) => String(nome || "").trim().split(" ")[0] || "";

module.exports = function (pool, logActivity) {
  const WHATSAPP_TENANT_TOKEN = "__whatsapp__";

  const debug = (...args) => {
    if (String(process.env.WHATSAPP_DEBUG || "").toLowerCase() === "true") {
      console.log("[whatsapp]", ...args);
    }
  };

  // ─── Envio ────────────────────────────────────────────────────────────────
  // O cliente da Zenvia vive em ../whatsappSender.js, compartilhado com as
  // notificações de chamado.

  const askType = (to, intro) =>
    sendButtons(
      to,
      intro,
      TYPE_OPTIONS.map((o) => ({ id: `type:${o.key}`, title: o.title })),
    );

  const askConfirm = (to, body) =>
    sendButtons(to, body, [
      { id: "confirm:yes", title: "Confirmar" },
      { id: "confirm:no", title: "Cancelar" },
    ]);

  // ─── Identificação do colaborador ─────────────────────────────────────────

  // O telefone chega como 55 + DDD + número e, no Brasil, pode vir sem o nono
  // dígito. Comparar DDD + os 8 últimos dígitos é estável nos dois formatos.
  const findInternalUserByPhone = async (waId) => {
    const digits = String(waId || "").replace(/\D/g, "");
    const national = digits.startsWith("55") ? digits.slice(2) : digits;
    if (national.length < 10) return null;

    const ddd = national.slice(0, 2);
    const last8 = national.slice(-8);

    const result = await pool.query(
      `SELECT u.id, u.nome, u.email
       FROM users u
       WHERE u.telefone IS NOT NULL
         AND LEFT(REGEXP_REPLACE(u.telefone, '[^0-9]', '', 'g'), 2) = $1
         AND RIGHT(REGEXP_REPLACE(u.telefone, '[^0-9]', '', 'g'), 8) = $2
         AND EXISTS (
           SELECT 1 FROM group_permissions gp
           WHERE gp.group_id = u.group_id
             AND gp.permission_key = 'internal_access'
         )
       LIMIT 1`,
      [ddd, last8],
    );
    return result.rows[0] || null;
  };

  // ─── Estado da conversa ───────────────────────────────────────────────────

  const getSession = async (waId) => {
    const result = await pool.query(
      `SELECT * FROM whatsapp_sessions
       WHERE wa_id = $1
         AND updated_at > NOW() - make_interval(mins => $2)`,
      [waId, SESSION_TTL_MINUTES],
    );
    return result.rows[0] || null;
  };

  const saveSession = async (waId, userId, state) => {
    await pool.query(
      `INSERT INTO whatsapp_sessions
         (wa_id, user_id, step, ticket_type, title, description, last_message_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (wa_id) DO UPDATE
         SET user_id         = EXCLUDED.user_id,
             step            = EXCLUDED.step,
             ticket_type     = EXCLUDED.ticket_type,
             title           = EXCLUDED.title,
             description     = EXCLUDED.description,
             last_message_id = EXCLUDED.last_message_id,
             updated_at      = NOW()`,
      [
        waId,
        userId,
        state.step,
        state.ticket_type ?? null,
        state.title ?? null,
        state.description ?? null,
        state.last_message_id ?? null,
      ],
    );
  };

  // ─── Criação do chamado ───────────────────────────────────────────────────

  // Tenant próprio do canal, na mesma ideia do canal de e-mail.
  const getOrCreateWhatsappTenant = async () => {
    const found = await pool.query(
      "SELECT id FROM widget_tenants WHERE token = $1 LIMIT 1",
      [WHATSAPP_TENANT_TOKEN],
    );
    if (found.rowCount) return found.rows[0].id;
    const created = await pool.query(
      `INSERT INTO widget_tenants (name, token, created_by)
       VALUES ($1, $2, NULL) RETURNING id`,
      ["WhatsApp", WHATSAPP_TENANT_TOKEN],
    );
    return created.rows[0].id;
  };

  const withTransaction = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  };

  // `sourceMessageId` = id da mensagem de confirmação. O índice único em
  // tickets.source_message_id garante que uma reentrega do webhook não crie
  // um chamado duplicado.
  const createTicket = async (session, user, sourceMessageId) => {
    const tenantId = await getOrCreateWhatsappTenant();
    const trackingToken = crypto.randomBytes(32).toString("hex");

    try {
      return await withTransaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO tickets
             (tenant_id, type, title, description, origin_url, name,
              requester_email, tracking_token, source_message_id)
           VALUES ($1, $2, $3, $4, 'whatsapp', $5, $6, $7, $8)
           RETURNING id, tracking_token`,
          [
            tenantId,
            session.ticket_type,
            session.title,
            session.description,
            user.nome,
            user.email,
            trackingToken,
            sourceMessageId,
          ],
        );
        return inserted.rows[0];
      });
    } catch (err) {
      // 23505 = violação de índice único → a mensagem já virou chamado.
      if (err.code === "23505") {
        const existing = await pool.query(
          "SELECT id, tracking_token FROM tickets WHERE source_message_id = $1 LIMIT 1",
          [sourceMessageId],
        );
        if (existing.rowCount) return existing.rows[0];
      }
      throw err;
    }
  };

  // ─── Leitura do payload da Zenvia ─────────────────────────────────────────

  // Envelope esperado:
  //   { type: "MESSAGE", direction: "IN", message: { id, from, to, contents } }
  // O clique em botão chega como conteúdo `text` com um campo `payload`
  // contendo o `id` do botão enviado.
  const parseInbound = (event) => {
    const message = event?.message || {};
    const contents = Array.isArray(message.contents) ? message.contents : [];
    const content =
      contents.find((c) => c && (c.type === "text" || c.payload)) ||
      contents[0] ||
      {};

    return {
      waId: message.from ? String(message.from) : null,
      messageId: String(message.id || event?.id || ""),
      text: String(content.text || "").trim(),
      payload: content.payload ? String(content.payload) : null,
    };
  };

  // Remove acentos e caixa, para comparar o texto digitado com os rótulos.
  const slug = (value) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  // Resolve a escolha do usuário aceitando: clique no botão (payload),
  // o número da opção ("2") ou o próprio rótulo digitado ("bug").
  const resolveChoice = (payload, text, prefix, options) => {
    if (payload && payload.startsWith(`${prefix}:`)) {
      const key = payload.slice(prefix.length + 1);
      if (options.some((o) => o.key === key)) return key;
    }

    const normalized = slug(text);
    if (!normalized) return null;

    const byIndex = Number(normalized);
    if (Number.isInteger(byIndex) && options[byIndex - 1]) {
      return options[byIndex - 1].key;
    }

    const byLabel = options.find(
      (o) =>
        slug(o.title) === normalized ||
        (o.aliases || []).some((a) => slug(a) === normalized),
    );
    return byLabel ? byLabel.key : null;
  };

  const CONFIRM_OPTIONS = [
    { key: "yes", title: "Confirmar", aliases: ["sim", "s", "ok", "confirmo"] },
    { key: "no", title: "Cancelar", aliases: ["nao", "n"] },
  ];

  // ─── Máquina de estados da conversa ───────────────────────────────────────

  const handleMessage = async (event) => {
    const { waId, messageId, text, payload } = parseInbound(event);
    if (!waId) {
      debug("mensagem sem remetente, ignorada:", JSON.stringify(event));
      return;
    }

    const user = await findInternalUserByPhone(waId);
    if (!user) {
      await sendText(
        waId,
        "Este canal é exclusivo para colaboradores da V-CORP. Se você faz parte da equipe, peça para cadastrarem este número de telefone no seu perfil do Painel.",
      );
      return;
    }

    const session = await getSession(waId);

    // Reentrega: a mesma mensagem não deve avançar a conversa duas vezes.
    if (session?.last_message_id && session.last_message_id === messageId) {
      return;
    }

    const startFlow = async (intro) => {
      await saveSession(waId, user.id, {
        step: "type",
        last_message_id: messageId,
      });
      await askType(waId, intro);
    };

    // Encerra a conversa mantendo o `last_message_id`: se o provedor reenviar
    // a mensagem que concluiu (ou cancelou) o fluxo, o guarda de reentrega
    // acima reconhece e ignora, em vez de abrir uma conversa nova. O registro
    // desaparece sozinho pelo TTL.
    const finishSession = () =>
      saveSession(waId, user.id, { step: "done", last_message_id: messageId });

    // Saída disponível em qualquer etapa.
    if (["cancelar", "sair", "parar"].includes(text.toLowerCase())) {
      await finishSession();
      await sendText(
        waId,
        "Tudo bem, cancelei a abertura do chamado. Quando quiser começar de novo, é só mandar uma mensagem.",
      );
      return;
    }

    // Sem conversa em andamento (ou expirada) → começa o fluxo.
    if (!session) {
      await startFlow(
        `Olá, ${firstName(user.nome)}! Vou te ajudar a abrir um chamado. Qual é o tipo?`,
      );
      return;
    }

    const base = { ...session, last_message_id: messageId };

    switch (session.step) {
      case "type": {
        const type = resolveChoice(payload, text, "type", TYPE_OPTIONS);
        if (!type) {
          await saveSession(waId, user.id, base);
          await askType(
            waId,
            "Não entendi. Escolha o tipo do chamado:",
          );
          return;
        }
        await saveSession(waId, user.id, {
          ...base,
          step: "title",
          ticket_type: type,
        });
        await sendText(
          waId,
          "Perfeito. Agora me diga o *assunto* do chamado, em uma frase curta.",
        );
        return;
      }

      case "title": {
        if (!text) {
          await saveSession(waId, user.id, base);
          await sendText(
            waId,
            "Preciso do assunto em texto, por favor — uma frase curta descrevendo o chamado.",
          );
          return;
        }
        await saveSession(waId, user.id, {
          ...base,
          step: "description",
          title: text.slice(0, TITLE_MAX),
        });
        await sendText(
          waId,
          "Anotado. Agora descreva o que está acontecendo, com o máximo de detalhes que puder.",
        );
        return;
      }

      case "description": {
        if (!text) {
          await saveSession(waId, user.id, base);
          await sendText(
            waId,
            "Preciso da descrição em texto, por favor. Se tiver imagens ou arquivos, anexe depois pelo Painel.",
          );
          return;
        }
        const description = text.slice(0, DESCRIPTION_MAX);
        await saveSession(waId, user.id, {
          ...base,
          step: "confirm",
          description,
        });
        await askConfirm(
          waId,
          `Confira antes de eu abrir:\n\n*Tipo:* ${TYPE_LABELS[session.ticket_type] || session.ticket_type}\n*Assunto:* ${session.title}\n*Descrição:* ${description}`,
        );
        return;
      }

      case "confirm": {
        const choice = resolveChoice(payload, text, "confirm", CONFIRM_OPTIONS);
        if (choice === "no") {
          await finishSession();
          await sendText(
            waId,
            "Cancelado, nada foi aberto. Se quiser tentar de novo, basta mandar uma mensagem.",
          );
          return;
        }
        if (choice !== "yes") {
          await saveSession(waId, user.id, base);
          await askConfirm(waId, "Confirmo a abertura do chamado?");
          return;
        }

        const ticket = await createTicket(session, user, messageId);
        await finishSession();
        await sendText(
          waId,
          `Chamado aberto! ✅\n\n*Protocolo:* #${ticket.id}\n\nVocê pode acompanhar o andamento por aqui:\n${FRONTEND_URL}/acompanhar?t=${ticket.tracking_token}\n\nEle também já aparece em *Meus Chamados* no Painel.`,
        );

        try {
          await logActivity(
            user.id,
            user.email,
            "Chamado Aberto (WhatsApp)",
            `Chamado #${ticket.id} aberto pelo bot de WhatsApp.`,
            null,
          );
        } catch (e) {
          console.warn("[whatsapp] Falha ao registrar log:", e);
        }
        return;
      }

      case "done": {
        // Conversa anterior já encerrada e esta é uma mensagem nova (a
        // reentrega foi filtrada antes) → abre um fluxo novo.
        await startFlow(
          `Olá, ${firstName(user.nome)}! Vamos abrir outro chamado. Qual é o tipo?`,
        );
        return;
      }

      default: {
        // Etapa desconhecida (ex.: schema alterado) → reinicia o fluxo.
        await startFlow("Vamos começar de novo. Qual é o tipo do chamado?");
        return;
      }
    }
  };

  // A Zenvia envia um evento por requisição, mas aceitamos lote por segurança.
  const handleWebhook = async (body) => {
    debug("payload recebido:", JSON.stringify(body));

    const events = Array.isArray(body) ? body : [body];
    for (const event of events) {
      const type = String(event?.type || "MESSAGE").toUpperCase();
      const direction = String(
        event?.direction || event?.message?.direction || "IN",
      ).toUpperCase();

      // Só mensagens recebidas: ignora recibos (MESSAGE_STATUS) e o eco das
      // nossas próprias respostas (direction OUT).
      if (type !== "MESSAGE" || direction !== "IN") {
        debug("evento ignorado:", type, direction);
        continue;
      }

      try {
        await handleMessage(event);
      } catch (err) {
        console.error("[whatsapp] Erro ao tratar mensagem:", err);
      }
    }
  };

  // ─── Webhook ──────────────────────────────────────────────────────────────

  // A Zenvia não assina os webhooks de entrada, então a autenticidade vem de
  // um segredo na própria URL cadastrada:
  //   https://.../api/whatsapp/webhook?token=<WHATSAPP_WEBHOOK_SECRET>
  // O segredo é aceito como query (`?token=…`) ou como último segmento do
  // caminho (`/webhook/<segredo>`), porque alguns painéis de provedor não
  // aceitam query string no campo da URL.
  const hasValidSecret = (req) => {
    const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!expected) return true; // sem segredo → não valida (ambiente de teste)
    const received = String(req.params.secret || req.query.token || "");
    try {
      return crypto.timingSafeEqual(
        Buffer.from(received),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  };

  // Conferência rápida de que a URL está no ar e o segredo bate.
  const healthHandler = (req, res) => {
    if (!hasValidSecret(req)) return res.sendStatus(403);
    return res.status(200).json({ ok: true, channel: "whatsapp" });
  };

  // Mensagens recebidas.
  const webhookHandler = (req, res) => {
    if (!hasValidSecret(req)) {
      return res.status(403).json({ error: "Segredo inválido." });
    }

    // Confirmamos na hora e seguimos processando fora do ciclo da resposta,
    // para o provedor não reenviar o evento por timeout.
    res.sendStatus(200);

    const body = req.body;
    setImmediate(() => {
      handleWebhook(body).catch((err) =>
        console.error("[whatsapp] Erro ao processar webhook:", err),
      );
    });
  };

  router.get("/webhook", healthHandler);
  router.get("/webhook/:secret", healthHandler);
  router.post("/webhook", webhookHandler);
  router.post("/webhook/:secret", webhookHandler);

  return router;
};
