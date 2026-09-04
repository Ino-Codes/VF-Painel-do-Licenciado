const express = require("express");
const crypto = require("crypto");
const multer = require("multer");
const router = express.Router();
const { isLoggedIn, checkPermission } = require("../middleware/auth.js");

// ── Anexos do chamado ──────────────────────────────────────────────────────
const ATTACHMENT_MAX_FILES = 3;
const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB por arquivo
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

// Multer dedicado aos anexos: memória, limite de tamanho/quantidade e
// whitelist de tipos (imagens, PDF e documentos comuns).
const ticketUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ATTACHMENT_MAX_SIZE, files: ATTACHMENT_MAX_FILES },
  fileFilter: (req, file, cb) => {
    if (ATTACHMENT_ALLOWED_MIMES.has(file.mimetype)) return cb(null, true);
    cb(new Error("TIPO_INVALIDO"));
  },
});

const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://painel.vcorporate.com.br";

const VALID_STATUSES = [
  "novo",
  "analise",
  "andamento",
  "concluido",
  "pausado",
];
const VALID_TYPES = ["help", "suggestion", "bug"];

const TYPE_LABELS = {
  help: "Ajuda",
  bug: "Bug",
  suggestion: "Sugestão",
};

// Fluxo de status permitido — deve espelhar o ALLOWED_TRANSITIONS do frontend.
const ALLOWED_TRANSITIONS = {
  novo: ["andamento"],
  andamento: ["concluido", "pausado"],
  concluido: [],
  pausado: ["andamento"],
};

const isAllowedTransition = (from, to) =>
  from === to || (ALLOWED_TRANSITIONS[from] || []).includes(to);

// Erro com status HTTP embutido — permite abortar uma transação e devolver o
// código correto (404/409) a partir de dentro do callback transacional.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.httpStatus = status;
  }
}

module.exports = function (pool, logActivity, resend, cloudinary) {
  // ── Helper: roda o middleware do multer e captura erros de upload ─────────
  const runAttachmentUpload = (req, res) =>
    new Promise((resolve, reject) => {
      ticketUpload.array("files", ATTACHMENT_MAX_FILES)(req, res, (err) =>
        err ? reject(err) : resolve(),
      );
    });

  // ── Helper: sobe um buffer para o Cloudinary (imagens ou arquivos raw) ────
  const uploadBufferToCloudinary = (file) =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "tickets", resource_type: "auto" },
        (error, result) => (error ? reject(error) : resolve(result)),
      );
      stream.end(file.buffer);
    });

  // ── Helper: busca os anexos de um chamado ─────────────────────────────────
  const getAttachments = async (ticketId) => {
    const result = await pool.query(
      `SELECT id, file_url, file_name, file_type
       FROM ticket_attachments
       WHERE ticket_id = $1
       ORDER BY id ASC`,
      [ticketId],
    );
    return result.rows;
  };

  // ── Helper: executa uma função dentro de uma transação (BEGIN/COMMIT) ─────
  // Garante que a atualização do ticket e o registro no histórico sejam
  // atômicos: ou os dois acontecem, ou nenhum.
  const withTransaction = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        /* ignora falha no rollback */
      }
      throw err;
    } finally {
      client.release();
    }
  };

  // ── Helper: registra uma transição de status no histórico ──────────────────
  // `db` pode ser o pool ou um client de transação (ambos expõem .query).
  const recordStatusChange = (
    db,
    { ticketId, fromStatus, toStatus, userId, userName },
  ) =>
    db.query(
      `INSERT INTO ticket_status_history
         (ticket_id, from_status, to_status, changed_by, changed_by_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [ticketId, fromStatus || null, toStatus, userId || null, userName || null],
    );
  // ── Helper: escapa valores do usuário antes de injetar no HTML do e-mail ──
  const escapeHtml = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // ── Helper: monta o corpo HTML estilizado do e-mail (padrão do Painel) ────
  const buildEmailHtml = ({ heading, greetingName, bodyHtml }) => `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="utf-8" /></head>
    <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr><td align="center" style="padding:20px 0;">
          <table width="600" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
            <tr><td align="center" style="background:#111217;padding:20px 0;">
              <img src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1782936553/textobranco_zxw32o.png" alt="V-CORP" style="width:200px;height:auto;">
            </td></tr>
            <tr><td style="padding:30px 40px;color:#2D2C2B;font-size:16px;line-height:1.6;">
              <h2 style="font-size:22px;color:#0D0D0D;margin-top:0;">${heading}</h2>
              <p>Olá, ${escapeHtml(greetingName)},</p>
              ${bodyHtml}
            </td></tr>
            <tr><td align="center" style="background:#f8f9fa;padding:20px;font-size:12px;color:#6c757d;">
              <p>V-CORP Inteligência Tributária © ${new Date().getFullYear()}</p>
              <p>Esta é uma mensagem automática. Por favor, não responda a este e-mail.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  // ── Helper: botão "Acompanhar meu chamado" nos e-mails ────────────────────
  const trackButtonHtml = (trackingToken) => {
    if (!trackingToken) return "";
    const trackUrl = `${FRONTEND_URL}/acompanhar?t=${trackingToken}`;
    return `
        <table border="0" cellspacing="0" cellpadding="0" style="margin:24px 0 12px;">
          <tr><td align="center" style="background:#daa520;border-radius:5px;">
            <a href="${trackUrl}" target="_blank" style="font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;padding:12px 24px;display:inline-block;">Acompanhar meu chamado</a>
          </td></tr>
        </table>
        <p style="font-size:13px;color:#6c757d;margin:0 0 8px;">Ou copie e cole este endereço no seu navegador:</p>
        <p style="font-size:13px;margin:0;word-break:break-all;"><a href="${trackUrl}" target="_blank" style="color:#daa520;">${trackUrl}</a></p>`;
  };

  // ── Helper: campos seguros expostos no acompanhamento público ─────────────
  const publicTicketView = (t) => ({
    id: t.id,
    type: t.type,
    title: t.title,
    status: t.status,
    created_at: t.created_at,
    tenant_name: t.tenant_name || null,
    attendant_name: t.attendant_name || null,
    resolution_notes: t.status === "concluido" ? t.resolution_notes : null,
  });

  // ── POST /api/ticket (público — chamado pelo widget) ────────────────────
  router.post("/", async (req, res) => {
    // Processa os anexos (multipart) antes de ler os campos do formulário.
    try {
      await runAttachmentUpload(req, res);
    } catch (uploadErr) {
      const byCode = {
        LIMIT_FILE_SIZE: "Cada anexo pode ter no máximo 10 MB.",
        LIMIT_FILE_COUNT: `Envie no máximo ${ATTACHMENT_MAX_FILES} anexos.`,
        LIMIT_UNEXPECTED_FILE: `Envie no máximo ${ATTACHMENT_MAX_FILES} anexos.`,
      };
      const message =
        uploadErr.message === "TIPO_INVALIDO"
          ? "Tipo de arquivo não permitido. Envie imagens, PDF ou documentos."
          : byCode[uploadErr.code] || "Falha ao processar os anexos.";
      return res.status(400).json({ error: message });
    }

    const {
      token,
      type,
      name,
      title,
      description,
      origin_url,
      requester_email,
    } = req.body;

    if (!token || !title) {
      return res
        .status(400)
        .json({ error: "Token e título são obrigatórios." });
    }

    if (!requester_email || !requester_email.includes("@")) {
      return res
        .status(400)
        .json({ error: "E-mail do solicitante é obrigatório." });
    }

    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: "Tipo inválido." });
    }

    try {
      // Valida o token e verifica se o tenant está ativo
      const tenantResult = await pool.query(
        "SELECT id FROM widget_tenants WHERE token = $1 AND active = true",
        [token],
      );

      if (tenantResult.rowCount === 0) {
        return res
          .status(401)
          .json({ error: "Token inválido ou tenant inativo." });
      }

      const tenantId = tenantResult.rows[0].id;
      const trackingToken = crypto.randomBytes(32).toString("hex");

      // Cria o ticket e registra o marco de abertura no histórico (atômico).
      const ticket = await withTransaction(async (client) => {
        const result = await client.query(
          `INSERT INTO tickets (tenant_id, type, title, description, origin_url, name, requester_email, tracking_token)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            tenantId,
            type,
            title,
            description,
            origin_url,
            name,
            requester_email,
            trackingToken,
          ],
        );
        const created = result.rows[0];
        await recordStatusChange(client, {
          ticketId: created.id,
          fromStatus: null,
          toStatus: created.status,
          userId: null,
          userName: name || null,
        });
        return created;
      });

      // ── Anexos: sobe cada arquivo pro Cloudinary e grava a referência ──
      const files = req.files || [];
      let savedCount = 0;
      for (const file of files) {
        try {
          const uploaded = await uploadBufferToCloudinary(file);
          await pool.query(
            `INSERT INTO ticket_attachments (ticket_id, file_url, file_name, file_type)
             VALUES ($1, $2, $3, $4)`,
            [ticket.id, uploaded.secure_url, file.originalname, file.mimetype],
          );
          savedCount += 1;
        } catch (attErr) {
          console.warn("Falha ao anexar arquivo ao chamado:", attErr);
        }
      }

      // ── E-mail de confirmação de abertura (não bloqueante) ──
      try {
        const typeLabel = TYPE_LABELS[ticket.type] || "Chamado";
        await resend.emails.send({
          from: `Painel V-CORP <${process.env.EMAIL_FROM}>`,
          to: requester_email,
          subject: `Chamado #${ticket.id} aberto - Painel V-CORP`,
          html: buildEmailHtml({
            heading: "Chamado aberto com sucesso",
            greetingName: name || "solicitante",
            bodyHtml: `
              <p>Recebemos o seu chamado e ele já está registrado no nosso sistema.</p>
              <p style="background:#f8f9fa;border-left:4px solid #daa520;padding:12px 16px;border-radius:4px;">
                <strong>Protocolo:</strong> #${ticket.id}<br/>
                <strong>Tipo:</strong> ${typeLabel}<br/>
                <strong>Título:</strong> ${escapeHtml(ticket.title)}${
                  savedCount > 0
                    ? `<br/><strong>Anexos:</strong> ${savedCount} arquivo(s)`
                    : ""
                }
              </p>
              <p>Nossa equipe irá analisá-lo em breve. Acompanhe o andamento pelo botão abaixo ou guarde o número do protocolo.</p>
              ${trackButtonHtml(ticket.tracking_token)}
            `,
          }),
        });
      } catch (mailErr) {
        console.warn("Falha ao enviar e-mail de abertura:", mailErr);
      }

      res.status(201).json({ success: true, id: ticket.id, attachments: savedCount });
    } catch (err) {
      console.error("Erro ao salvar ticket:", err);
      res.status(500).json({ error: "Erro ao salvar ticket." });
    }
  });

  // ── Ingestão de chamados por e-mail (webhook do Resend Inbound) ───────────
  const INBOUND_TENANT_TOKEN = "__inbound_email__";

  // Tenant "E-mail" dedicado: criado sob demanda (idempotente por token fixo).
  const getOrCreateEmailTenant = async () => {
    const found = await pool.query(
      "SELECT id FROM widget_tenants WHERE token = $1 LIMIT 1",
      [INBOUND_TENANT_TOKEN],
    );
    if (found.rowCount) return found.rows[0].id;
    const created = await pool.query(
      `INSERT INTO widget_tenants (name, token, created_by)
       VALUES ($1, $2, NULL) RETURNING id`,
      ["E-mail (suporte@)", INBOUND_TENANT_TOKEN],
    );
    return created.rows[0].id;
  };

  // Extrai nome/e-mail de um cabeçalho "From" (string "Nome <e@x>" ou objeto).
  const parseFromHeader = (rawFrom) => {
    if (!rawFrom) return { email: "", name: "" };
    if (typeof rawFrom === "object") {
      return {
        email: String(rawFrom.address || rawFrom.email || "").trim(),
        name: String(rawFrom.name || "").trim(),
      };
    }
    const str = String(rawFrom).trim();
    const m = str.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    if (m) return { name: m[1].trim(), email: m[2].trim() };
    return { name: "", email: str };
  };

  // Remove tags HTML de forma básica (fallback quando não há texto puro).
  const stripHtml = (html) =>
    String(html || "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  // Verifica a assinatura do webhook (padrão Svix, usado pelo Resend).
  // Só é exigida quando RESEND_WEBHOOK_SECRET está configurado.
  const verifyResendSignature = (req) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return true; // sem segredo → não valida (ambiente de teste)
    try {
      const id = req.headers["svix-id"];
      const ts = req.headers["svix-timestamp"];
      const sigHeader = req.headers["svix-signature"];
      if (!id || !ts || !sigHeader || !req.rawBody) return false;
      const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
      const signed = `${id}.${ts}.${req.rawBody.toString("utf8")}`;
      const expected = crypto
        .createHmac("sha256", key)
        .update(signed)
        .digest("base64");
      return String(sigHeader)
        .split(" ")
        .some((part) => {
          const sig = part.split(",")[1];
          if (!sig) return false;
          try {
            return crypto.timingSafeEqual(
              Buffer.from(sig),
              Buffer.from(expected),
            );
          } catch {
            return false;
          }
        });
    } catch {
      return false;
    }
  };

  // O webhook do Resend traz só METADADOS dos anexos. Para o conteúdo é preciso
  // listar via API (retorna um download_url válido por ~1h) e baixar cada um,
  // respeitando os limites atuais (quantidade, tipo e tamanho).
  const downloadInboundAttachments = async (emailId) => {
    const files = [];
    if (!emailId) return files;
    try {
      const attRes = await resend.emails.receiving.attachments.list({ emailId });
      const list = attRes?.data?.data || attRes?.data || [];
      for (const att of Array.isArray(list) ? list : []) {
        if (files.length >= ATTACHMENT_MAX_FILES) break;
        const mimetype = att.content_type || att.contentType || "";
        if (!ATTACHMENT_ALLOWED_MIMES.has(mimetype) || !att.download_url) {
          continue;
        }
        try {
          const resp = await fetch(att.download_url);
          if (!resp.ok) continue;
          const buffer = Buffer.from(await resp.arrayBuffer());
          if (!buffer.length || buffer.length > ATTACHMENT_MAX_SIZE) continue;
          files.push({
            buffer,
            originalname: att.filename || "anexo",
            mimetype,
          });
        } catch (dlErr) {
          console.warn("Falha ao baixar anexo (e-mail):", dlErr);
        }
      }
    } catch (listErr) {
      console.warn("Falha ao listar anexos (e-mail):", listErr);
    }
    return files;
  };

  // POST /api/ticket/inbound — recebe o e-mail parseado e abre o chamado.
  router.post("/inbound", async (req, res) => {
    if (!verifyResendSignature(req)) {
      return res.status(401).json({ error: "Assinatura inválida." });
    }

    try {
      const body = req.body || {};
      const data = body.data || body;

      // Ignora eventos que não sejam de e-mail recebido (quando o tipo vem).
      const eventType = String(body.type || body.event || "").toLowerCase();
      if (
        eventType &&
        !eventType.includes("received") &&
        !eventType.includes("inbound")
      ) {
        return res.status(200).json({ ignored: true, reason: "evento-nao-inbound" });
      }

      const { email: senderEmail, name: senderName } = parseFromHeader(
        data.from ?? data.sender ?? data.From,
      );

      if (!senderEmail || !senderEmail.includes("@")) {
        return res.status(200).json({ ignored: true, reason: "remetente-ausente" });
      }

      // Proteção contra loop: ignora e-mails do próprio remetente automático.
      const selfAddr = String(process.env.EMAIL_FROM || "").toLowerCase();
      if (selfAddr && senderEmail.toLowerCase() === selfAddr) {
        return res.status(200).json({ ignored: true, reason: "auto-remetente" });
      }

      const emailId = data.email_id || data.emailId || null;
      const title =
        String(data.subject || data.Subject || "").trim() || "(Sem assunto)";

      // O corpo (text/html) NÃO vem no webhook — busca o e-mail completo pela
      // API do Resend usando o email_id.
      let bodyText = "";
      let bodyHtml = "";
      try {
        const { data: full, error } = await resend.emails.receiving.get(emailId);
        if (error) throw error;
        bodyText = String(full?.text || "").trim();
        bodyHtml = String(full?.html || "");
      } catch (getErr) {
        console.warn("Falha ao buscar corpo do e-mail recebido:", getErr);
      }
      const description = bodyText || stripHtml(bodyHtml) || "(Sem conteúdo)";

      // Idempotência: se este e-mail já virou chamado, não duplica.
      const messageId =
        data.message_id ||
        data.messageId ||
        data.email_id ||
        (data.headers &&
          (data.headers["message-id"] || data.headers["Message-Id"])) ||
        body.id ||
        null;
      if (messageId) {
        const dup = await pool.query(
          "SELECT id FROM tickets WHERE source_message_id = $1 LIMIT 1",
          [String(messageId)],
        );
        if (dup.rowCount) {
          return res.status(200).json({ duplicated: true, id: dup.rows[0].id });
        }
      }

      const tenantId = await getOrCreateEmailTenant();
      const trackingToken = crypto.randomBytes(32).toString("hex");

      const ticket = await withTransaction(async (client) => {
        const result = await client.query(
          `INSERT INTO tickets
             (tenant_id, type, title, description, origin_url, name, requester_email, tracking_token, source_message_id)
           VALUES ($1, 'help', $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            tenantId,
            title,
            description,
            "email:suporte@vcorporate.com.br",
            senderName || senderEmail,
            senderEmail,
            trackingToken,
            messageId ? String(messageId) : null,
          ],
        );
        const created = result.rows[0];
        await recordStatusChange(client, {
          ticketId: created.id,
          fromStatus: null,
          toStatus: created.status,
          userId: null,
          userName: senderName || senderEmail,
        });
        return created;
      });

      // Anexos: lista via API, baixa e sobe pro Cloudinary (respeita limites).
      const inboundFiles = await downloadInboundAttachments(emailId);
      let savedCount = 0;
      for (const file of inboundFiles) {
        try {
          const uploaded = await uploadBufferToCloudinary(file);
          await pool.query(
            `INSERT INTO ticket_attachments (ticket_id, file_url, file_name, file_type)
             VALUES ($1, $2, $3, $4)`,
            [ticket.id, uploaded.secure_url, file.originalname, file.mimetype],
          );
          savedCount += 1;
        } catch (attErr) {
          console.warn("Falha ao anexar arquivo (e-mail):", attErr);
        }
      }

      // Confirmação ao remetente (não bloqueante).
      try {
        await resend.emails.send({
          from: `Painel V-CORP <${process.env.EMAIL_FROM}>`,
          to: senderEmail,
          subject: `Chamado #${ticket.id} aberto - Painel V-CORP`,
          html: buildEmailHtml({
            heading: "Chamado aberto com sucesso",
            greetingName: senderName || "solicitante",
            bodyHtml: `
              <p>Recebemos o seu e-mail e ele já foi registrado como um chamado no nosso sistema.</p>
              <p style="background:#f8f9fa;border-left:4px solid #daa520;padding:12px 16px;border-radius:4px;">
                <strong>Protocolo:</strong> #${ticket.id}<br/>
                <strong>Título:</strong> ${escapeHtml(ticket.title)}${
                  savedCount > 0
                    ? `<br/><strong>Anexos:</strong> ${savedCount} arquivo(s)`
                    : ""
                }
              </p>
              <p>Nossa equipe irá analisá-lo em breve. Acompanhe o andamento pelo botão abaixo ou guarde o número do protocolo.</p>
              ${trackButtonHtml(ticket.tracking_token)}
            `,
          }),
        });
      } catch (mailErr) {
        console.warn("Falha ao enviar confirmação (e-mail):", mailErr);
      }

      return res
        .status(201)
        .json({ success: true, id: ticket.id, attachments: savedCount });
    } catch (err) {
      console.error("Erro ao processar e-mail de entrada:", err);
      // 500 → o provedor reentrega; a idempotência (source_message_id) evita
      // duplicar caso o chamado já tenha sido criado antes da falha.
      return res.status(500).json({ error: "Falha ao processar o e-mail." });
    }
  });

  // ── GET /api/ticket/track/:token (público — acompanhamento por link) ─────
  router.get("/track/:token", async (req, res) => {
    const { token } = req.params;
    try {
      const result = await pool.query(
        `SELECT t.*, wt.name AS tenant_name
         FROM tickets t
         LEFT JOIN widget_tenants wt ON t.tenant_id = wt.id
         WHERE t.tracking_token = $1`,
        [token],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Chamado não encontrado." });
      }
      const t = result.rows[0];
      const attachments = await getAttachments(t.id);
      res.json({ ...publicTicketView(t), attachments });
    } catch (err) {
      console.error("Erro ao consultar chamado (token):", err);
      res.status(500).json({ error: "Erro ao consultar chamado." });
    }
  });

  // ── POST /api/ticket/track (público — consulta por protocolo + e-mail) ────
  router.post("/track", async (req, res) => {
    const { id, email } = req.body;
    const ticketId = parseInt(String(id ?? "").replace(/\D/g, ""), 10);

    if (!ticketId || !email) {
      return res
        .status(400)
        .json({ error: "Protocolo e e-mail são obrigatórios." });
    }

    try {
      const result = await pool.query(
        `SELECT t.*, wt.name AS tenant_name
         FROM tickets t
         LEFT JOIN widget_tenants wt ON t.tenant_id = wt.id
         WHERE t.id = $1 AND LOWER(t.requester_email) = LOWER($2)`,
        [ticketId, String(email).trim()],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({
          error: "Chamado não encontrado. Confira o protocolo e o e-mail.",
        });
      }
      const t = result.rows[0];
      const attachments = await getAttachments(t.id);
      res.json({ ...publicTicketView(t), attachments });
    } catch (err) {
      console.error("Erro ao consultar chamado (protocolo):", err);
      res.status(500).json({ error: "Erro ao consultar chamado." });
    }
  });

  // ── GET /api/tickets/mine (protegido — chamados do usuário logado) ───────
  // Lista os chamados abertos com o e-mail do usuário logado, na mesma forma
  // pública da consulta por protocolo (sem campos internos de atendimento).
  router.get("/mine", isLoggedIn, async (req, res) => {
    const email = req.user?.email;
    if (!email) {
      return res.status(400).json({ error: "Usuário sem e-mail cadastrado." });
    }

    try {
      const result = await pool.query(
        `SELECT t.*, wt.name AS tenant_name,
                COALESCE(
                  (
                    SELECT json_agg(
                             json_build_object(
                               'id', a.id,
                               'file_url', a.file_url,
                               'file_name', a.file_name,
                               'file_type', a.file_type
                             )
                             ORDER BY a.id ASC
                           )
                    FROM ticket_attachments a
                    WHERE a.ticket_id = t.id
                  ),
                  '[]'
                ) AS attachments
         FROM tickets t
         LEFT JOIN widget_tenants wt ON t.tenant_id = wt.id
         WHERE LOWER(t.requester_email) = LOWER($1)
         ORDER BY t.created_at DESC`,
        [String(email).trim()],
      );

      res.json(
        result.rows.map((t) => ({
          ...publicTicketView(t),
          attachments: t.attachments || [],
        })),
      );
    } catch (err) {
      console.error("Erro ao listar os chamados do usuário:", err);
      res.status(500).json({ error: "Erro ao listar os seus chamados." });
    }
  });

  // ── GET /api/tickets (protegido — painel interno) ───────────────────────
  router.get("/", isLoggedIn, checkPermission("tickets.view"), async (req, res) => {
    const { tenant_id, status, type } = req.query;

    try {
      const params = [];
      const whereClauses = [];

      if (tenant_id) {
        params.push(tenant_id);
        whereClauses.push(`f.tenant_id = $${params.length}`);
      }

      if (status) {
        params.push(status);
        whereClauses.push(`f.status = $${params.length}`);
      }

      if (type) {
        params.push(type);
        whereClauses.push(`f.type = $${params.length}`);
      }

      const whereString =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const result = await pool.query(
        `SELECT f.*, wt.name AS tenant_name,
                COALESCE(
                  (
                    SELECT json_agg(
                             json_build_object(
                               'id', a.id,
                               'file_url', a.file_url,
                               'file_name', a.file_name,
                               'file_type', a.file_type
                             )
                             ORDER BY a.id ASC
                           )
                    FROM ticket_attachments a
                    WHERE a.ticket_id = f.id
                  ),
                  '[]'
                ) AS attachments
         FROM tickets f
         LEFT JOIN widget_tenants wt ON f.tenant_id = wt.id
         ${whereString}
         ORDER BY f.created_at DESC`,
        params,
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar tickets:", err);
      res.status(500).json({ error: "Erro ao buscar tickets." });
    }
  });

  // ── PATCH /api/tickets/:id (atualiza status / observação / resolução) ────
  // Aceita qualquer combinação dos campos; monta o UPDATE dinamicamente.
  router.patch(
    "/:id",
    isLoggedIn,
    checkPermission("tickets.manage"),
    async (req, res) => {
      const { id } = req.params;
      const { status, observation, resolution_notes } = req.body;

      if (status !== undefined && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Status inválido." });
      }

      const fields = [];
      const params = [];

      if (status !== undefined) {
        params.push(status);
        fields.push(`status = $${params.length}`);
      }
      if (observation !== undefined) {
        params.push(observation);
        fields.push(`observation = $${params.length}`);
      }
      if (resolution_notes !== undefined) {
        params.push(resolution_notes);
        fields.push(`resolution_notes = $${params.length}`);
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: "Nenhum campo para atualizar." });
      }

      params.push(id);

      try {
        const updated = await withTransaction(async (client) => {
          // Trava a linha e lê o status atual — para validar a transição e
          // registrar o "from" no histórico.
          const cur = await client.query(
            "SELECT status FROM tickets WHERE id = $1 FOR UPDATE",
            [id],
          );
          if (cur.rowCount === 0) {
            throw new HttpError(404, "Ticket não encontrado.");
          }
          const from = cur.rows[0].status;

          if (status !== undefined && !isAllowedTransition(from, status)) {
            throw new HttpError(
              409,
              `Transição de status não permitida: ${from} → ${status}.`,
            );
          }

          const result = await client.query(
            `UPDATE tickets SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
            params,
          );

          // Registra no histórico apenas quando o status realmente muda.
          if (status !== undefined && status !== from) {
            await recordStatusChange(client, {
              ticketId: Number(id),
              fromStatus: from,
              toStatus: status,
              userId: req.user.id,
              userName: req.user.nome || req.user.email,
            });
          }

          return result.rows[0];
        });

        res.json(updated);
      } catch (err) {
        if (err.httpStatus) {
          return res.status(err.httpStatus).json({ error: err.message });
        }
        console.error("Erro ao atualizar ticket:", err);
        res.status(500).json({ error: "Erro ao atualizar ticket." });
      }
    },
  );

  // ── PATCH /api/tickets/:id/attend (inicia atendimento) ──────────────────
  router.patch(
    "/:id/attend",
    isLoggedIn,
    checkPermission("tickets.manage"),
    async (req, res) => {
      const { id } = req.params;

      try {
        const ticket = await withTransaction(async (client) => {
          const cur = await client.query(
            "SELECT status FROM tickets WHERE id = $1 FOR UPDATE",
            [id],
          );
          if (cur.rowCount === 0) {
            throw new HttpError(404, "Ticket não encontrado.");
          }
          const from = cur.rows[0].status;

          const result = await client.query(
            `UPDATE tickets
             SET status = 'andamento',
                 attendant_id = $1,
                 attendant_name = $2
             WHERE id = $3
             RETURNING *`,
            [req.user.id, req.user.nome || req.user.email, id],
          );

          if (from !== "andamento") {
            await recordStatusChange(client, {
              ticketId: Number(id),
              fromStatus: from,
              toStatus: "andamento",
              userId: req.user.id,
              userName: req.user.nome || req.user.email,
            });
          }

          return result.rows[0];
        });

        try {
          logActivity(
            req.user.id,
            req.user.email,
            "Atendimento Iniciado",
            `Ticket ID ${id} assumido por ${req.user.nome || req.user.email}.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log:", e);
        }

        res.json(ticket);
      } catch (err) {
        if (err.httpStatus) {
          return res.status(err.httpStatus).json({ error: err.message });
        }
        console.error("Erro ao iniciar atendimento:", err);
        res.status(500).json({ error: "Erro ao iniciar atendimento." });
      }
    },
  );

  // ── PATCH /api/tickets/:id/close (encerra atendimento + e-mail) ─────────
  router.patch(
    "/:id/close",
    isLoggedIn,
    checkPermission("tickets.manage"),
    async (req, res) => {
      const { id } = req.params;
      const { resolution_notes } = req.body;

      try {
        const ticket = await withTransaction(async (client) => {
          const cur = await client.query(
            "SELECT status FROM tickets WHERE id = $1 FOR UPDATE",
            [id],
          );
          if (cur.rowCount === 0) {
            throw new HttpError(404, "Ticket não encontrado.");
          }
          const from = cur.rows[0].status;

          const result = await client.query(
            `UPDATE tickets
               SET status = 'concluido',
                   resolution_notes = COALESCE($1, resolution_notes)
             WHERE id = $2
             RETURNING *`,
            [resolution_notes, id],
          );

          if (from !== "concluido") {
            await recordStatusChange(client, {
              ticketId: Number(id),
              fromStatus: from,
              toStatus: "concluido",
              userId: req.user.id,
              userName: req.user.nome || req.user.email,
            });
          }

          return result.rows[0];
        });

        // Busca o e-mail do atendente para colocar em cópia (CC)
        let attendantEmail = null;
        if (ticket.attendant_id) {
          const att = await pool.query(
            "SELECT email FROM users WHERE id = $1",
            [ticket.attendant_id],
          );
          attendantEmail = att.rows[0] ? att.rows[0].email : null;
        }

        // ── E-mail de conclusão ao solicitante (CC atendente) ──
        if (ticket.requester_email) {
          try {
            const payload = {
              from: `Painel V-CORP <${process.env.EMAIL_FROM}>`,
              to: ticket.requester_email,
              subject: `Chamado #${ticket.id} concluído - Painel V-CORP`,
              html: buildEmailHtml({
                heading: "Seu chamado foi concluído",
                greetingName: ticket.name || "solicitante",
                bodyHtml: `
                  <p>O seu chamado <strong>#${ticket.id}</strong> - "${escapeHtml(ticket.title)}", foi concluído.</p>
                  ${
                    ticket.resolution_notes
                      ? `<p><strong>Instruções de resolução:</strong></p>
                         <p style="background:#f8f9fa;border-left:4px solid #04a146;padding:12px 16px;border-radius:4px;white-space:pre-wrap;">${escapeHtml(
                           ticket.resolution_notes,
                         )}</p>`
                      : ""
                  }
                  <p style="font-size:14px;color:#6c757d;">Atendido por: ${escapeHtml(
                    ticket.attendant_name || "Equipe V-CORP",
                  )}</p>
                  ${trackButtonHtml(ticket.tracking_token)}
                `,
              }),
            };
            if (attendantEmail) payload.cc = [attendantEmail];

            await resend.emails.send(payload);
          } catch (mailErr) {
            console.warn("Falha ao enviar e-mail de conclusão:", mailErr);
          }
        }

        try {
          logActivity(
            req.user.id,
            req.user.email,
            "Atendimento Encerrado",
            `Ticket ID ${id} concluído por ${req.user.nome || req.user.email}.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log:", e);
        }

        res.json(ticket);
      } catch (err) {
        if (err.httpStatus) {
          return res.status(err.httpStatus).json({ error: err.message });
        }
        console.error("Erro ao encerrar atendimento:", err);
        res.status(500).json({ error: "Erro ao encerrar atendimento." });
      }
    },
  );

  // ── DELETE /api/tickets/:id ──────────────────────────────────────────────
  router.delete(
    "/:id",
    isLoggedIn,
    checkPermission("tickets.manage"),
    async (req, res) => {
      const { id } = req.params;

      try {
        const result = await pool.query(
          "DELETE FROM tickets WHERE id = $1 RETURNING title",
          [id],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "ticket não encontrado." });
        }

        try {
          logActivity(
            req.user.id,
            req.user.email,
            "Ticket Excluído",
            `Ticket "${result.rows[0].title}" (ID ${id}) excluído.`,
            req.ipAddress,
          );
        } catch (e) {
          console.warn("Falha ao registrar log:", e);
        }

        res.json({ success: true });
      } catch (err) {
        console.error("Erro ao excluir ticket:", err);
        res.status(500).json({ error: "Erro ao excluir ticket." });
      }
    },
  );

  return router;
};
