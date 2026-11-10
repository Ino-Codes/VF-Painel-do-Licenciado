// ───────────────────────────────────────────────────────────────────────────
// Convite de 1º acesso — teste de integração (node:test, sem dependência nova).
//
// O banco de desenvolvimento é o de PRODUÇÃO: tudo roda numa única conexão
// dentro de BEGIN … ROLLBACK (os BEGIN/COMMIT das rotas viram SAVEPOINTs) e
// nada é gravado de verdade. O Resend é um stub: nenhum e-mail sai.
//
// Rodar (de backend/):  DATABASE_URL=... node --test tests/
// Sem DATABASE_URL o teste é pulado.
// ───────────────────────────────────────────────────────────────────────────
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

// Nunca usar credenciais reais de e-mail nem o segredo real do JWT no teste.
delete process.env.RESEND_API_KEY;
process.env.JWT_SECRET = "segredo-de-teste-" + crypto.randomBytes(8).toString("hex");
process.env.EMAIL_FROM = "teste@example.invalid";

const SEM_BANCO = !process.env.DATABASE_URL;

let client, pool, server, base, resend, adminToken, adminId;
const MARCA = `convite-teste-${Date.now()}`;
const emailDeTeste = (n) => `${MARCA}-${n}@example.invalid`;

// ── Pool falso: uma conexão, uma transação ────────────────────────────────
function poolNaTransacao(conn) {
  let n = 0;
  let encerrado = false;
  const q = (sql, params) => {
    if (encerrado) return Promise.reject(new Error("query depois do ROLLBACK"));
    return conn.query(sql, params);
  };
  const transacao = () => {
    const pilha = [];
    return {
      query(sql, params) {
        const s = typeof sql === "string" ? sql.trim().toUpperCase() : "";
        if (s === "BEGIN") {
          const sp = `sp_${++n}`;
          pilha.push(sp);
          return q(`SAVEPOINT ${sp}`);
        }
        if (s === "COMMIT") {
          const sp = pilha.pop();
          return sp ? q(`RELEASE SAVEPOINT ${sp}`) : Promise.resolve();
        }
        if (s === "ROLLBACK") {
          const sp = pilha.pop();
          return sp ? q(`ROLLBACK TO SAVEPOINT ${sp}`) : Promise.resolve();
        }
        return q(sql, params);
      },
      release() {},
    };
  };
  return {
    query: q,
    connect: async () => transacao(),
    encerrar() {
      encerrado = true;
    },
  };
}

// ── Stub do Resend ────────────────────────────────────────────────────────
function resendStub() {
  const stub = {
    enviados: [],
    falhar: false,
    emails: {
      send: async (msg) => {
        stub.enviados.push(msg);
        return stub.falhar
          ? { data: null, error: { message: "falha simulada" } }
          : { data: { id: "stub" }, error: null };
      },
    },
    ultimoPara(email) {
      return [...stub.enviados].reverse().find((m) => m.to === email);
    },
  };
  return stub;
}

const linkDoEmail = (msg) => {
  const m = msg.html.match(/href="([^"]*reset-password\?[^"]+)"/);
  assert.ok(m, "e-mail sem link de definição de senha");
  return new URL(m[1].replace(/&amp;/g, "&"));
};
const codigoDoEmail = (msg) => msg.html.match(/>(\d{6})</)[1];
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

async function api(metodo, caminho, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const r = await fetch(`${base}${caminho}`, { method: metodo, headers, body: payload });
  const texto = await r.text();
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    dados = texto;
  }
  return { status: r.status, dados };
}

const linha = async (id) =>
  (await pool.query("SELECT * FROM users WHERE id = $1", [id])).rows[0];

before(async () => {
  if (SEM_BANCO) return;
  const { Client } = require("pg");
  const express = require("express");
  const multer = require("multer");
  const jwt = require("jsonwebtoken");

  client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("BEGIN");
  pool = poolNaTransacao(client);
  resend = resendStub();

  const logActivity = (userId, userEmail, action, details, ip) =>
    pool
      .query(
        `INSERT INTO activity_logs (user_id, user_email, action, details, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, userEmail, action, details, ip],
      )
      .catch(() => {});

  const { initAuth } = require("../middleware/auth.js");
  initAuth(pool);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.ipAddress = `ip-${MARCA}`;
    next();
  });
  app.use("/api/auth", require("../routes/auth.js")(pool, resend, logActivity));
  app.use(
    "/api/users",
    require("../routes/users.js")(
      pool,
      {},
      multer({ storage: multer.memoryStorage() }),
      logActivity,
      resend,
    ),
  );
  await new Promise((ok) => {
    server = app.listen(0, ok);
  });
  base = `http://127.0.0.1:${server.address().port}`;

  // Admin de teste num grupo que tem users.manage.
  const g = await pool.query(
    "SELECT group_id FROM group_permissions WHERE permission_key = 'users.manage' LIMIT 1",
  );
  assert.ok(g.rows[0], "nenhum grupo com users.manage no banco");
  const a = await pool.query(
    `INSERT INTO users (nome, email, password, role, group_id, must_change_password)
     VALUES ('Admin Teste', $1, 'x', 'admin', $2, FALSE) RETURNING id`,
    [emailDeTeste("admin"), g.rows[0].group_id],
  );
  adminId = a.rows[0].id;
  adminToken = jwt.sign(
    { id: adminId, email: emailDeTeste("admin"), group_id: g.rows[0].group_id },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
});

after(async () => {
  if (SEM_BANCO) return;
  // Deixa as gravações "dispare e esqueça" (logActivity) entrarem na fila da
  // conexão antes do ROLLBACK; depois dele, qualquer query é recusada.
  await new Promise((ok) => setTimeout(ok, 300));
  await client.query("ROLLBACK");
  pool.encerrar();
  await client.end();
  await new Promise((ok) => server.close(ok));
});

const t = (nome, fn) => test(nome, { skip: SEM_BANCO && "sem DATABASE_URL" }, fn);

// ── Cenários ──────────────────────────────────────────────────────────────

let conviteAna; // { id, token }

t("criar usuário envia o convite e ignora a senha do formulário", async () => {
  const email = emailDeTeste("ana");
  const r = await api("POST", "/api/users/admin", {
    token: adminToken,
    body: { nome: "ana souza", email, password: "123456", role: "licenciado" },
  });
  assert.equal(r.status, 201, JSON.stringify(r.dados));
  assert.equal(r.dados.convite_enviado, true);

  const msg = resend.ultimoPara(email);
  assert.ok(msg, "convite não enviado");
  assert.match(msg.subject, /Bem-vindo/);
  assert.match(msg.html, /Ana Souza/);
  const url = linkDoEmail(msg);
  assert.equal(url.pathname, "/reset-password");
  assert.equal(url.searchParams.get("convite"), "1");
  const token = url.searchParams.get("token");
  assert.match(token, /^[0-9a-f]{64}$/);

  const u = await linha(r.dados.id);
  assert.equal(u.must_change_password, true);
  assert.equal(u.reset_token, sha256(token), "só o hash do token fica no banco");
  const horas = (new Date(u.reset_token_expires) - Date.now()) / 3600000;
  assert.ok(horas > 71.9 && horas <= 72, `validade de ${horas}h`);
  assert.equal(await require("bcryptjs").compare("123456", u.password), false);

  // Antes de criar a senha, não há como entrar.
  const login = await api("POST", "/api/auth/login", { body: { email, password: "123456" } });
  assert.equal(login.status, 401);

  conviteAna = { id: r.dados.id, token, email };
});

t("o link define a senha, vale uma vez e o login segue com 2FA", async () => {
  const { id, token, email } = conviteAna;
  const fraca = await api("POST", "/api/auth/redefinir-senha", {
    body: { token, password: "curta1" },
  });
  assert.equal(fraca.status, 400, "a política de senha vale no convite");

  const r = await api("POST", "/api/auth/redefinir-senha", {
    body: { token, password: "NovaSenha2026" },
  });
  assert.equal(r.status, 200, JSON.stringify(r.dados));
  assert.match(r.dados.message, /criada/);

  const u = await linha(id);
  assert.equal(u.must_change_password, false);
  assert.equal(u.reset_token, null);
  assert.ok(u.password_changed_at);

  const deNovo = await api("POST", "/api/auth/redefinir-senha", {
    body: { token, password: "OutraSenha2026" },
  });
  assert.equal(deNovo.status, 400, "o link do convite vale uma vez só");

  const login = await api("POST", "/api/auth/login", {
    body: { email, password: "NovaSenha2026" },
  });
  assert.equal(login.status, 200, JSON.stringify(login.dados));
  assert.equal(login.dados.twoFactorRequired, true);
  const codigo = codigoDoEmail(resend.ultimoPara(email));
  const v = await api("POST", "/api/auth/verify-2fa", { body: { email, code: codigo } });
  assert.equal(v.status, 200, JSON.stringify(v.dados));
  assert.equal(v.dados.user.must_change_password, false);

  // Sessão normal: sem a trava da troca obrigatória.
  const me = await api("GET", "/api/users/internal", { token: v.dados.token });
  assert.equal(me.status, 200);

  // Quem já criou a senha não recebe convite (usa "Esqueceu a senha?").
  const reenvio = await api("POST", `/api/users/admin/${id}/convite`, { token: adminToken });
  assert.equal(reenvio.status, 409);
});

t("reenviar convite derruba a senha inicial antiga, o link e as sessões", async () => {
  const bcrypt = require("bcryptjs");
  const jwt = require("jsonwebtoken");
  const email = emailDeTeste("legado");
  // Conta no formato antigo: senha inicial conhecida, nunca trocada.
  const u = await pool.query(
    `INSERT INTO users (nome, email, password, role, must_change_password)
     VALUES ('Conta Legada', $1, $2, 'licenciado', TRUE) RETURNING id`,
    [email, await bcrypt.hash("Senha123", 10)],
  );
  const id = u.rows[0].id;
  const sessaoAntiga = jwt.sign(
    { id, email, iat: Math.floor(Date.now() / 1000) - 60 },
    process.env.JWT_SECRET,
  );

  const r1 = await api("POST", `/api/users/admin/${id}/convite`, { token: adminToken });
  assert.equal(r1.status, 200, JSON.stringify(r1.dados));
  const token1 = linkDoEmail(resend.ultimoPara(email)).searchParams.get("token");

  assert.equal(await bcrypt.compare("Senha123", (await linha(id)).password), false);
  const login = await api("POST", "/api/auth/login", { body: { email, password: "Senha123" } });
  assert.equal(login.status, 401, "a senha inicial antiga não entra mais");

  const sessao = await api("PUT", "/api/users/force-change-password", {
    token: sessaoAntiga,
    body: { password: "Qualquer2026" },
  });
  assert.equal(sessao.status, 401, "sessão aberta com a senha antiga é encerrada");
  assert.equal(sessao.dados.code, "SESSAO_ENCERRADA");

  // Reenviar de novo invalida o link anterior.
  const r2 = await api("POST", `/api/users/admin/${id}/convite`, { token: adminToken });
  assert.equal(r2.status, 200);
  const token2 = linkDoEmail(resend.ultimoPara(email)).searchParams.get("token");
  assert.notEqual(token1, token2);
  const velho = await api("POST", "/api/auth/redefinir-senha", {
    body: { token: token1, password: "NovaSenha2026" },
  });
  assert.equal(velho.status, 400);

  // Limite: 3 convites por conta em 15 min.
  const r3 = await api("POST", `/api/users/admin/${id}/convite`, { token: adminToken });
  assert.equal(r3.status, 200);
  const r4 = await api("POST", `/api/users/admin/${id}/convite`, { token: adminToken });
  assert.equal(r4.status, 429);

  const novo = await api("POST", "/api/auth/redefinir-senha", {
    body: { token: linkDoEmail(resend.ultimoPara(email)).searchParams.get("token"), password: "NovaSenha2026" },
  });
  assert.equal(novo.status, 200);
});

t("só quem gerencia usuários reenvia convite", async () => {
  const jwt = require("jsonwebtoken");
  const semPermissao = jwt.sign({ id: adminId, email: "x", group_id: -1 }, process.env.JWT_SECRET);
  const r = await api("POST", `/api/users/admin/${conviteAna.id}/convite`, { token: semPermissao });
  assert.equal(r.status, 403);
  const m = await api("POST", "/api/users/admin/convites/reenviar-pendentes", {
    token: semPermissao,
    body: {},
  });
  assert.equal(m.status, 403);
});

t("falha no Resend: a conta é criada e o admin é avisado", async () => {
  const email = emailDeTeste("falha");
  resend.falhar = true;
  try {
    const r = await api("POST", "/api/users/admin", {
      token: adminToken,
      body: { nome: "Falha Envio", email, role: "licenciado" },
    });
    assert.equal(r.status, 201);
    assert.equal(r.dados.convite_enviado, false);
    assert.ok(await linha(r.dados.id));
  } finally {
    resend.falhar = false;
  }
  const dup = await api("POST", "/api/users/admin", {
    token: adminToken,
    body: { nome: "Falha Envio", email, role: "licenciado" },
  });
  assert.equal(dup.status, 409, "e-mail repetido");
});

t("CSV: a coluna password é opcional e ignorada; cada conta recebe convite", async () => {
  const bcrypt = require("bcryptjs");
  const e1 = emailDeTeste("csv1");
  const e2 = emailDeTeste("csv2");
  const csv = `nome,email,password,role\nCsv Um,${e1},123456,licenciado\nCsv Dois,${e2},,licenciado\nSem Papel,${emailDeTeste("csv3")},,\n`;
  const form = new FormData();
  form.append("file", new Blob([csv], { type: "text/csv" }), "u.csv");
  const r = await api("POST", "/api/users/admin/bulk-upload", { token: adminToken, form });
  assert.equal(r.status, 200, JSON.stringify(r.dados));
  assert.equal(r.dados.successCount, 2);
  assert.equal(r.dados.convitesEnviados, 2);
  assert.equal(r.dados.errorCount, 1, "linha sem role");

  for (const e of [e1, e2]) {
    const msg = resend.ultimoPara(e);
    assert.ok(msg, `sem convite para ${e}`);
    assert.equal(linkDoEmail(msg).searchParams.get("convite"), "1");
  }
  const u1 = (await pool.query("SELECT * FROM users WHERE email = $1", [e1])).rows[0];
  assert.equal(await bcrypt.compare("123456", u1.password), false, "senha do CSV ignorada");
  assert.equal(u1.must_change_password, true);

  // Sem a coluna password também funciona.
  const form2 = new FormData();
  form2.append(
    "file",
    new Blob([`nome,email,role\nCsv Quatro,${emailDeTeste("csv4")},licenciado\n`], { type: "text/csv" }),
    "u.csv",
  );
  const r2 = await api("POST", "/api/users/admin/bulk-upload", { token: adminToken, form: form2 });
  assert.equal(r2.dados.successCount, 1);
});

t("lista marca convite pendente; reenvio em massa pula quem foi convidado na última hora", async () => {
  const lista = await api("GET", `/api/users/admin?search=${MARCA}&limit=50`, { token: adminToken });
  assert.equal(lista.status, 200);
  const porEmail = Object.fromEntries(lista.dados.users.map((u) => [u.email, u]));
  assert.equal(porEmail[emailDeTeste("ana")].convite_pendente, false);
  assert.equal(porEmail[emailDeTeste("csv1")].convite_pendente, true);
  assert.equal(porEmail[emailDeTeste("admin")].convite_pendente, false);

  const pend = await api("GET", "/api/users/admin/convites/pendentes?internal=false", {
    token: adminToken,
  });
  assert.equal(pend.status, 200);
  console.log(
    `   (banco real: ${pend.dados.totalPendentes} V-Partners com convite pendente, contando os de teste)`,
  );

  // Conta pendente sem convite recente (o formato antigo) + as de teste que
  // acabaram de receber convite (devem ficar de fora).
  const bcrypt = require("bcryptjs");
  const antigo = emailDeTeste("massa");
  const a = await pool.query(
    `INSERT INTO users (nome, email, password, role, must_change_password)
     VALUES ('Massa Antiga', $1, $2, 'licenciado', TRUE) RETURNING id`,
    [antigo, await bcrypt.hash("Senha123", 10)],
  );

  // Para o envio em massa alcançar só as contas de teste, as reais ficam
  // fora DENTRO da transação (desfeito no ROLLBACK; nenhum e-mail sai).
  await pool.query(
    `UPDATE users SET must_change_password = FALSE
      WHERE must_change_password AND email NOT LIKE $1`,
    [`${MARCA}-%`],
  );

  const antes = resend.enviados.length;
  const m = await api("POST", "/api/users/admin/convites/reenviar-pendentes", {
    token: adminToken,
    body: { internal: "false" },
  });
  assert.equal(m.status, 200, JSON.stringify(m.dados));
  // A conta antiga e a do convite que falhou no Resend (lá em cima) entram;
  // as convidadas há pouco ficam de fora.
  assert.equal(m.dados.enviados, 2, JSON.stringify(m.dados));
  assert.deepEqual(
    resend.enviados.slice(antes).map((e) => e.to).sort(),
    [antigo, emailDeTeste("falha")].sort(),
  );
  assert.equal(await bcrypt.compare("Senha123", (await linha(a.rows[0].id)).password), false);

  // Clique duplo: nada sai de novo.
  const m2 = await api("POST", "/api/users/admin/convites/reenviar-pendentes", {
    token: adminToken,
    body: { internal: "false" },
  });
  assert.equal(m2.dados.enviados, 0);
});

t("a redefinição comum continua com o texto e a validade de 15 minutos", async () => {
  const email = conviteAna.email;
  await api("POST", "/api/auth/solicitar-redefinicao", { body: { email } });
  // O envio é assíncrono (a resposta sai antes).
  for (let i = 0; i < 50 && !/Redefini/.test(resend.ultimoPara(email)?.subject || ""); i++) {
    await new Promise((ok) => setTimeout(ok, 100));
  }
  const msg = resend.ultimoPara(email);
  assert.match(msg.subject, /Redefinição de Senha/);
  const url = linkDoEmail(msg);
  assert.equal(url.searchParams.get("convite"), null);
  const u = await linha(conviteAna.id);
  const min = (new Date(u.reset_token_expires) - Date.now()) / 60000;
  assert.ok(min > 14 && min <= 15, `validade de ${min} min`);
  assert.equal(u.must_change_password, false, "redefinir não reabre o convite");
});
