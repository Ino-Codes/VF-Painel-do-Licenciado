// backend/routes/whatsapp.js
// Bot de atendimento no WhatsApp, via Zenvia (BSP oficial da Meta).
//
// Fluxos:
//   • Menu inicial → abrir chamado ou consultar os seus chamados.
//   • Abertura guiada: tipo → assunto → descrição → confirmação.
//     A descrição ACUMULA várias mensagens (no WhatsApp as pessoas escrevem
//     em frases curtas), encerrada por um botão; arquivos enviados no meio do
//     caminho viram anexos do chamado.
//   • Vínculo de telefone: número desconhecido informa o e-mail corporativo e
//     confirma um código de 6 dígitos enviado por e-mail — aí o telefone é
//     salvo no perfil e a pessoa passa a ser reconhecida.
//
// O canal é restrito a quem tem `internal_access`. O e-mail do usuário
// identificado vira o `requester_email` do chamado, então ele aparece em Meus
// Chamados no Painel e recebe as notificações que já existem.
//
// Variáveis de ambiente:
//   ZENVIA_API_TOKEN, ZENVIA_FROM  → envio (ver ../whatsappSender.js)
//   WHATSAPP_WEBHOOK_SECRET        → segredo exigido na URL do webhook
//   WHATSAPP_DEBUG                 → "true" registra o payload recebido
const express = require("express");
const crypto = require("crypto");
const { sendText, sendButtons } = require("../whatsappSender.js");
const router = express.Router();

// Conversa abandonada expira: a próxima mensagem começa um fluxo novo.
const SESSION_TTL_MINUTES = 24 * 60;

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

// Mesmas restrições do upload pelo Painel (routes/tickets.js).
const ATTACHMENT_MAX_FILES = 3;
const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;
const ATTACHMENT_ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

// Vínculo de telefone.
const LINK_CODE_TTL_MINUTES = 15;
const LINK_MAX_ATTEMPTS = 5;

const TYPE_LABELS = { help: "Ajuda", bug: "Bug", suggestion: "Sugestão" };

// Opções do passo "tipo". O índice serve de atalho digitado (1, 2, 3) quando
// os botões não chegam renderizados.
const TYPE_OPTIONS = [
  { key: "help", title: "Ajuda" },
  { key: "bug", title: "Bug" },
  { key: "suggestion", title: "Sugestão" },
];

const MENU_OPTIONS = [
  { key: "new", title: "Abrir chamado", aliases: ["abrir", "novo"] },
  { key: "list", title: "Meus chamados", aliases: ["consultar", "meus"] },
];

const CONFIRM_OPTIONS = [
  { key: "yes", title: "Confirmar", aliases: ["sim", "s", "ok", "confirmo"] },
  { key: "no", title: "Cancelar", aliases: ["nao", "n"] },
];

// Rótulos de status para a consulta de chamados (inclui `analise`, que existe
// no backend e ficava sem tradução).
const STATUS_LABELS = {
  novo: "Recebido",
  analise: "Em análise",
  andamento: "Em atendimento",
  concluido: "Concluído",
  pausado: "Pausado",
};

const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://painel.vcorporate.com.br";

const firstName = (nome) => String(nome || "").trim().split(" ")[0] || "";

const formatDate = (value) =>
  new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

module.exports = function (pool, logActivity, resend, cloudinary) {
  const WHATSAPP_TENANT_TOKEN = "__whatsapp__";

  const debug = (...args) => {
    if (String(process.env.WHATSAPP_DEBUG || "").toLowerCase() === "true") {
      console.log("[whatsapp]", ...args);
    }
  };

  // ─── Perguntas recorrentes ────────────────────────────────────────────────

  const askMenu = (to, intro) =>
    sendButtons(
      to,
      intro,
      MENU_OPTIONS.map((o) => ({ id: `menu:${o.key}`, title: o.title })),
    );

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

  const askDescriptionDone = (to, body) =>
    sendButtons(to, body, [{ id: "desc:done", title: "Pronto, pode abrir" }]);

  // ─── Identificação do colaborador ─────────────────────────────────────────

  // O telefone chega como 55 + DDD + número e, no Brasil, pode vir sem o nono
  // dígito. Comparar DDD + os 8 últimos dígitos é estável nos dois formatos.
  const splitPhone = (waId) => {
    const digits = String(waId || "").replace(/\D/g, "");
    const national = digits.startsWith("55") ? digits.slice(2) : digits;
    if (national.length < 10) return null;
    return { national, ddd: national.slice(0, 2), last8: national.slice(-8) };
  };

  const INTERNAL_EXISTS = `
    EXISTS (
      SELECT 1 FROM group_permissions gp
       WHERE gp.group_id = u.group_id
         AND gp.permission_key = 'internal_access'
    )`;

  const findInternalUserByPhone = async (waId) => {
    const parts = splitPhone(waId);
    if (!parts) return null;

    const result = await pool.query(
      `SELECT u.id, u.nome, u.email
         FROM users u
        WHERE u.telefone IS NOT NULL
          AND LEFT(REGEXP_REPLACE(u.telefone, '[^0-9]', '', 'g'), 2) = $1
          AND RIGHT(REGEXP_REPLACE(u.telefone, '[^0-9]', '', 'g'), 8) = $2
          AND ${INTERNAL_EXISTS}
        LIMIT 1`,
      [parts.ddd, parts.last8],
    );
    return result.rows[0] || null;
  };

  const findInternalUserByEmail = async (email) => {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.email, u.telefone
         FROM users u
        WHERE LOWER(u.email) = LOWER($1)
          AND ${INTERNAL_EXISTS}
        LIMIT 1`,
      [String(email).trim()],
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

  // Grava o estado inteiro: o upsert substitui todas as colunas, então quem
  // chama deve espalhar a sessão atual (`{ ...session, ... }`) para não perder
  // o que não está mudando.
  const saveSession = async (waId, userId, state) => {
    await pool.query(
      `INSERT INTO whatsapp_sessions
         (wa_id, user_id, step, ticket_type, title, description,
          last_message_id, link_email, link_code_hash, link_code_expires_at,
          link_attempts, attachments, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (wa_id) DO UPDATE
         SET user_id              = EXCLUDED.user_id,
             step                 = EXCLUDED.step,
             ticket_type          = EXCLUDED.ticket_type,
             title                = EXCLUDED.title,
             description          = EXCLUDED.description,
             last_message_id      = EXCLUDED.last_message_id,
             link_email           = EXCLUDED.link_email,
             link_code_hash       = EXCLUDED.link_code_hash,
             link_code_expires_at = EXCLUDED.link_code_expires_at,
             link_attempts        = EXCLUDED.link_attempts,
             attachments          = EXCLUDED.attachments,
             updated_at           = NOW()`,
      [
        waId,
        userId ?? null,
        state.step,
        state.ticket_type ?? null,
        state.title ?? null,
        state.description ?? null,
        state.last_message_id ?? null,
        state.link_email ?? null,
        state.link_code_hash ?? null,
        state.link_code_expires_at ?? null,
        state.link_attempts ?? 0,
        JSON.stringify(state.attachments ?? []),
      ],
    );
  };

  // ─── Criação do chamado ───────────────────────────────────────────────────

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
    const attachments = Array.isArray(session.attachments)
      ? session.attachments
      : [];

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
        const ticket = inserted.rows[0];

        for (const att of attachments) {
          await client.query(
            `INSERT INTO ticket_attachments
               (ticket_id, file_url, file_name, file_type)
             VALUES ($1, $2, $3, $4)`,
            [ticket.id, att.file_url, att.file_name, att.file_type],
          );
        }

        return ticket;
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

  // ─── Anexos ───────────────────────────────────────────────────────────────

  const uploadToCloudinary = (buffer) =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "tickets", resource_type: "auto" },
        (error, result) => (error ? reject(error) : resolve(result)),
      );
      stream.end(buffer);
    });

  // Baixa o arquivo da Zenvia e sobe para o Cloudinary na hora, para não
  // depender da URL de origem continuar válida até a criação do chamado.
  // Devolve { ok, attachment } ou { ok: false, reason }.
  const storeAttachment = async (file) => {
    const mime = String(file.fileMimeType || "").split(";")[0].trim();
    if (!ATTACHMENT_ALLOWED_MIMES.has(mime)) {
      return { ok: false, reason: "tipo" };
    }
    try {
      const response = await fetch(file.fileUrl);
      if (!response.ok) {
        console.error("[whatsapp] Falha ao baixar anexo:", response.status);
        return { ok: false, reason: "download" };
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > ATTACHMENT_MAX_SIZE) {
        return { ok: false, reason: "tamanho" };
      }

      const uploaded = await uploadToCloudinary(buffer);
      return {
        ok: true,
        attachment: {
          file_url: uploaded.secure_url,
          file_name: file.fileName || `anexo.${uploaded.format || "bin"}`,
          file_type: mime,
        },
      };
    } catch (err) {
      console.error("[whatsapp] Erro ao processar anexo:", err);
      return { ok: false, reason: "erro" };
    }
  };

  // ─── Consulta de chamados ─────────────────────────────────────────────────

  const listMyTickets = async (user) => {
    const result = await pool.query(
      `SELECT id, title, status, created_at
         FROM tickets
        WHERE LOWER(requester_email) = LOWER($1)
        ORDER BY created_at DESC
        LIMIT 5`,
      [user.email],
    );
    return result.rows;
  };

  // ─── Vínculo de telefone ──────────────────────────────────────────────────

  const hashCode = (code) =>
    crypto.createHash("sha256").update(String(code)).digest("hex");

  const sendLinkCodeEmail = async (user, code) => {
    if (!resend) {
      console.warn("[whatsapp] resend ausente — código não enviado.");
      return false;
    }
    try {
      await resend.emails.send({
        from: `Painel V-CORP <${process.env.EMAIL_FROM}>`,
        to: user.email,
        subject: "Código para vincular seu WhatsApp - Painel V-CORP",
        html: `
          <p>Olá, ${firstName(user.nome)}!</p>
          <p>Use o código abaixo no WhatsApp para vincular o seu número ao Painel da V-CORP:</p>
          <p style="font-size:28px;font-weight:bold;letter-spacing:6px;">${code}</p>
          <p>O código vale por ${LINK_CODE_TTL_MINUTES} minutos.</p>
          <p style="font-size:13px;color:#6c757d;">Se não foi você que pediu, ignore este e-mail e avise o time de TI.</p>
        `,
      });
      return true;
    } catch (err) {
      console.error("[whatsapp] Falha ao enviar código por e-mail:", err);
      return false;
    }
  };

  // ─── Leitura do payload da Zenvia ─────────────────────────────────────────

  // Envelope esperado:
  //   { type: "MESSAGE", direction: "IN", message: { id, from, to, contents } }
  // O clique em botão chega como conteúdo `text` com um campo `payload`
  // contendo o `id` do botão enviado. Mídia chega como conteúdo `file`.
  const parseInbound = (event) => {
    const message = event?.message || {};
    const contents = Array.isArray(message.contents) ? message.contents : [];
    const textual =
      contents.find((c) => c && (c.type === "text" || c.payload)) || {};
    const file = contents.find((c) => c && c.type === "file") || null;

    return {
      waId: message.from ? String(message.from) : null,
      messageId: String(message.id || event?.id || ""),
      text: String(textual.text || "").trim(),
      payload: textual.payload ? String(textual.payload) : null,
      file,
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

  // ─── Máquina de estados ───────────────────────────────────────────────────

  const handleMessage = async (event) => {
    const { waId, messageId, text, payload, file } = parseInbound(event);
    if (!waId) {
      debug("mensagem sem remetente, ignorada:", JSON.stringify(event));
      return;
    }

    const session = await getSession(waId);

    // Reentrega: a mesma mensagem não deve avançar a conversa duas vezes.
    if (session?.last_message_id && session.last_message_id === messageId) {
      return;
    }

    const user = await findInternalUserByPhone(waId);

    // ── Número não reconhecido → fluxo de vínculo ──
    if (!user) {
      await handleLinkFlow({ waId, messageId, text, session });
      return;
    }

    const startFlow = async () => {
      await saveSession(waId, user.id, {
        step: "type",
        last_message_id: messageId,
        attachments: [],
      });
      await askType(waId, "Qual é o tipo do chamado?");
    };

    const showMenu = async (intro) => {
      await saveSession(waId, user.id, {
        step: "menu",
        last_message_id: messageId,
        attachments: [],
      });
      await askMenu(waId, intro);
    };

    // Encerra a conversa mantendo o `last_message_id`: se o provedor reenviar
    // a mensagem que concluiu o fluxo, o guarda de reentrega acima reconhece
    // e ignora, em vez de abrir uma conversa nova.
    const finishSession = () =>
      saveSession(waId, user.id, {
        step: "done",
        last_message_id: messageId,
        attachments: [],
      });

    // Saída disponível em qualquer etapa.
    if (["cancelar", "sair", "parar"].includes(slug(text))) {
      await finishSession();
      await sendText(
        waId,
        "Tudo bem, cancelei. Quando quiser, é só mandar uma mensagem.",
      );
      return;
    }

    if (!session || session.step === "done") {
      await showMenu(
        `Olá, ${firstName(user.nome)}! Sou o atendimento da V-CORP. O que você precisa?`,
      );
      return;
    }

    const base = { ...session, last_message_id: messageId };

    switch (session.step) {
      case "menu": {
        const choice = resolveChoice(payload, text, "menu", MENU_OPTIONS);
        if (choice === "new") {
          await startFlow();
          return;
        }
        if (choice === "list") {
          const tickets = await listMyTickets(user);
          if (!tickets.length) {
            await showMenu(
              "Você ainda não tem chamados abertos com este número. Quer abrir um agora?",
            );
            return;
          }
          const linhas = tickets.map(
            (t) =>
              `*#${t.id}* — ${t.title}\n   ${
                STATUS_LABELS[t.status] || t.status
              } · ${formatDate(t.created_at)}`,
          );
          await sendText(
            waId,
            `Seus chamados mais recentes:\n\n${linhas.join("\n\n")}`,
          );
          await showMenu("Posso ajudar em algo mais?");
          return;
        }
        await saveSession(waId, user.id, base);
        await askMenu(waId, "Não entendi. Escolha uma opção:");
        return;
      }

      case "type": {
        const type = resolveChoice(payload, text, "type", TYPE_OPTIONS);
        if (!type) {
          await saveSession(waId, user.id, base);
          await askType(waId, "Não entendi. Escolha o tipo do chamado:");
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
        const truncated = text.length > TITLE_MAX;
        await saveSession(waId, user.id, {
          ...base,
          step: "description",
          title: text.slice(0, TITLE_MAX),
        });
        await askDescriptionDone(
          waId,
          `${
            truncated
              ? `Ficou longo, então resumi o assunto para os primeiros ${TITLE_MAX} caracteres.\n\n`
              : ""
          }Agora descreva o que está acontecendo. Pode mandar em várias mensagens e anexar fotos ou arquivos — quando terminar, toque em *Pronto, pode abrir*.`,
        );
        return;
      }

      case "description": {
        // Encerrou a coleta?
        if (payload === "desc:done" || slug(text) === "pronto") {
          const atuais = Array.isArray(session.attachments)
            ? session.attachments
            : [];
          if (!session.description && !atuais.length) {
            await saveSession(waId, user.id, base);
            await askDescriptionDone(
              waId,
              "Preciso de pelo menos uma descrição antes de abrir. O que está acontecendo?",
            );
            return;
          }
          await saveSession(waId, user.id, { ...base, step: "confirm" });
          await askConfirm(
            waId,
            `Confira antes de eu abrir:\n\n*Tipo:* ${
              TYPE_LABELS[session.ticket_type] || session.ticket_type
            }\n*Assunto:* ${session.title}\n*Descrição:* ${
              session.description || "(sem texto)"
            }${atuais.length ? `\n*Anexos:* ${atuais.length}` : ""}`,
          );
          return;
        }

        const atuais = Array.isArray(session.attachments)
          ? session.attachments
          : [];
        let attachments = atuais;
        const avisos = [];

        // Arquivo enviado no meio da descrição vira anexo do chamado.
        if (file) {
          if (attachments.length >= ATTACHMENT_MAX_FILES) {
            avisos.push(
              `Só consigo anexar ${ATTACHMENT_MAX_FILES} arquivos por chamado, então este ficou de fora.`,
            );
          } else {
            const stored = await storeAttachment(file);
            if (stored.ok) {
              attachments = [...attachments, stored.attachment];
              avisos.push(`Anexo recebido (${attachments.length}/${ATTACHMENT_MAX_FILES}).`);
            } else if (stored.reason === "tipo") {
              avisos.push("Esse tipo de arquivo não é aceito, então ignorei o anexo.");
            } else if (stored.reason === "tamanho") {
              avisos.push("O arquivo passou de 10 MB, então ignorei o anexo.");
            } else {
              avisos.push("Não consegui baixar esse anexo, pode tentar de novo?");
            }
          }
        }

        // Texto (ou legenda do arquivo) acumula na descrição.
        const trecho = text || String(file?.fileCaption || "").trim();
        let description = session.description || "";
        if (trecho) {
          const juntos = description ? `${description}\n${trecho}` : trecho;
          if (juntos.length > DESCRIPTION_MAX) {
            description = juntos.slice(0, DESCRIPTION_MAX);
            avisos.push(
              `A descrição atingiu o limite de ${DESCRIPTION_MAX} caracteres, então o resto não entrou.`,
            );
          } else {
            description = juntos;
          }
        }

        await saveSession(waId, user.id, { ...base, description, attachments });

        // Silêncio a cada frase seria ruim; repetir a instrução inteira toda
        // vez também. Só falamos quando há um aviso relevante.
        if (avisos.length) {
          await askDescriptionDone(
            waId,
            `${avisos.join(" ")}\n\nPode continuar ou tocar em *Pronto, pode abrir*.`,
          );
        }
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
        const anexos = Array.isArray(session.attachments)
          ? session.attachments.length
          : 0;
        await finishSession();
        await sendText(
          waId,
          `Chamado aberto! ✅\n\n*Protocolo:* #${ticket.id}${
            anexos ? `\n*Anexos:* ${anexos}` : ""
          }\n\nVocê pode acompanhar o andamento por aqui:\n${FRONTEND_URL}/acompanhar?t=${ticket.tracking_token}\n\nEle também já aparece em *Meus Chamados* no Painel.`,
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

      default: {
        await showMenu("Vamos começar de novo. O que você precisa?");
        return;
      }
    }
  };

  // ─── Fluxo de vínculo de telefone ─────────────────────────────────────────

  const handleLinkFlow = async ({ waId, messageId, text, session }) => {
    const step = session?.step;

    // Pedido do e-mail (entrada no fluxo ou repetição).
    if (step !== "link_email" && step !== "link_code") {
      await saveSession(waId, null, {
        step: "link_email",
        last_message_id: messageId,
        attachments: [],
      });
      await sendText(
        waId,
        "Olá! Este canal é o atendimento interno da V-CORP e ainda não reconheço este número.\n\nSe você é da equipe, me diga o seu *e-mail corporativo* que eu envio um código para vincular o seu WhatsApp.",
      );
      return;
    }

    if (step === "link_email") {
      const email = text.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await saveSession(waId, null, {
          ...session,
          last_message_id: messageId,
        });
        await sendText(
          waId,
          "Isso não parece um e-mail. Me manda o seu e-mail corporativo, por favor.",
        );
        return;
      }

      const user = await findInternalUserByEmail(email);
      // Resposta idêntica em qualquer caso: confirmar se um e-mail existe (ou
      // se é de um colaborador interno) daria uma pista a quem está tentando
      // adivinhar endereços.
      const respostaNeutra =
        "Se esse e-mail for de um colaborador, enviei um código de 6 dígitos para ele agora. Me manda o código aqui.";

      if (!user) {
        await saveSession(waId, null, {
          step: "link_code",
          last_message_id: messageId,
          link_email: email,
          link_code_hash: null,
          link_code_expires_at: null,
          link_attempts: 0,
          attachments: [],
        });
        await sendText(waId, respostaNeutra);
        return;
      }

      // Número já usado por outra pessoa: vincular sobrescreveria o cadastro
      // dela, então paramos e mandamos para o time de TI.
      const parts = splitPhone(waId);
      const emUso = await pool.query(
        `SELECT 1 FROM users u
          WHERE u.id <> $1
            AND u.telefone IS NOT NULL
            AND LEFT(REGEXP_REPLACE(u.telefone, '[^0-9]', '', 'g'), 2) = $2
            AND RIGHT(REGEXP_REPLACE(u.telefone, '[^0-9]', '', 'g'), 8) = $3
          LIMIT 1`,
        [user.id, parts.ddd, parts.last8],
      );
      if (emUso.rowCount) {
        await saveSession(waId, null, {
          step: "done",
          last_message_id: messageId,
          attachments: [],
        });
        await sendText(
          waId,
          "Este número já está cadastrado no perfil de outra pessoa. Fale com o time de TI para ajustar antes de usar o atendimento por aqui.",
        );
        return;
      }

      const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
      const expires = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60 * 1000);
      await sendLinkCodeEmail(user, code);

      await saveSession(waId, null, {
        step: "link_code",
        last_message_id: messageId,
        link_email: user.email,
        link_code_hash: hashCode(code),
        link_code_expires_at: expires,
        link_attempts: 0,
        attachments: [],
      });
      await sendText(waId, respostaNeutra);
      return;
    }

    // step === "link_code"
    const informado = text.replace(/\D/g, "");
    const tentativas = Number(session.link_attempts || 0) + 1;

    if (tentativas > LINK_MAX_ATTEMPTS) {
      await saveSession(waId, null, {
        step: "done",
        last_message_id: messageId,
        attachments: [],
      });
      await sendText(
        waId,
        "Muitas tentativas. Por segurança, encerrei por aqui — mande uma mensagem para começar de novo.",
      );
      return;
    }

    const expirado =
      !session.link_code_expires_at ||
      new Date(session.link_code_expires_at).getTime() < Date.now();
    const confere =
      Boolean(session.link_code_hash) &&
      informado.length === 6 &&
      hashCode(informado) === session.link_code_hash;

    if (!confere || expirado) {
      await saveSession(waId, null, {
        ...session,
        last_message_id: messageId,
        link_attempts: tentativas,
      });
      await sendText(
        waId,
        expirado && session.link_code_hash
          ? "Esse código expirou. Me manda o seu e-mail corporativo de novo que eu envio outro."
          : `Código incorreto. Tente novamente (tentativa ${tentativas} de ${LINK_MAX_ATTEMPTS}).`,
      );
      if (expirado && session.link_code_hash) {
        await saveSession(waId, null, {
          step: "link_email",
          last_message_id: messageId,
          attachments: [],
        });
      }
      return;
    }

    const user = await findInternalUserByEmail(session.link_email);
    if (!user) {
      await saveSession(waId, null, {
        step: "done",
        last_message_id: messageId,
        attachments: [],
      });
      await sendText(waId, "Não consegui concluir o vínculo. Fale com o time de TI.");
      return;
    }

    // Grava no formato do Painel (nacional, só dígitos).
    const parts = splitPhone(waId);
    await pool.query("UPDATE users SET telefone = $1 WHERE id = $2", [
      parts.national,
      user.id,
    ]);

    try {
      await logActivity(
        user.id,
        user.email,
        "WhatsApp Vinculado",
        "Telefone vinculado ao perfil pelo bot de WhatsApp (código por e-mail).",
        null,
      );
    } catch (e) {
      console.warn("[whatsapp] Falha ao registrar log:", e);
    }

    await saveSession(waId, user.id, {
      step: "menu",
      last_message_id: messageId,
      attachments: [],
    });
    await askMenu(
      waId,
      `Tudo certo, ${firstName(user.nome)}! Seu WhatsApp está vinculado ao Painel. O que você precisa?`,
    );
  };

  // ─── Webhook ──────────────────────────────────────────────────────────────

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

  // A Zenvia não assina os webhooks de entrada, então a autenticidade vem de
  // um segredo na própria URL. Aceito como query (`?token=…`) ou como último
  // segmento do caminho (`/webhook/<segredo>`).
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

  const healthHandler = (req, res) => {
    if (!hasValidSecret(req)) return res.sendStatus(403);
    return res.status(200).json({ ok: true, channel: "whatsapp" });
  };

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
