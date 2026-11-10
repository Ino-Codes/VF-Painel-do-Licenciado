// ───────────────────────────────────────────────────────────────────────────
// Sessão e senha: tudo que emite token, valida senha nova ou limita
// tentativas passa por aqui, para as regras não divergirem entre as rotas.
//
// - emitirSessao: monta o token SEMPRE a partir do banco (grupo, troca de
//   senha obrigatória...). Antes cada rota montava o seu e alguns tokens
//   perdiam campos — e a do avatar assinava o token de qualquer id da URL.
// - estadoDaConta: o isLoggedIn usa para derrubar tokens emitidos antes da
//   última troca de senha e para travar quem ainda precisa trocar a senha.
// - excedeuLimite: conta tentativas recentes no activity_logs (vale para
//   todas as instâncias do backend, sem dependência nova).
// ───────────────────────────────────────────────────────────────────────────
const jwt = require("jsonwebtoken");
const { getGroupPermissions } = require("./permissionCache.js");

const SESSAO_DURACAO = "12h";

// Campos que nunca saem do backend.
const CAMPOS_SECRETOS = [
  "password",
  "two_factor_code",
  "two_factor_expires",
  "two_factor_attempts",
  "reset_token",
  "reset_token_expires",
  "password_changed_at",
];

const semSegredos = (user) => {
  const limpo = { ...user };
  for (const campo of CAMPOS_SECRETOS) delete limpo[campo];
  return limpo;
};

// E-mail como está gravado: o cadastro sempre grava em minúsculas e sem
// espaços, então o login precisa comparar do mesmo jeito.
const normalizarEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

// ── Política de senha ──────────────────────────────────────────────────────
// bcrypt só considera os primeiros 72 bytes; o teto evita senhas que pareçam
// diferentes mas tenham o mesmo hash.
const SENHA_MIN = 8;
const SENHA_MAX = 64;

/** Retorna a mensagem de erro, ou null se a senha é aceitável. */
const validarSenha = (senha, email) => {
  if (typeof senha !== "string" || senha.length < SENHA_MIN) {
    return `A senha deve ter pelo menos ${SENHA_MIN} caracteres.`;
  }
  if (senha.length > SENHA_MAX) {
    return `A senha deve ter no máximo ${SENHA_MAX} caracteres.`;
  }
  if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) {
    return "A senha deve ter letras e números.";
  }
  const usuario = normalizarEmail(email).split("@")[0];
  if (usuario && usuario.length >= 4 && senha.toLowerCase().includes(usuario)) {
    return "A senha não pode conter o seu e-mail.";
  }
  return null;
};

// ── Estado da conta (cache curto por usuário) ──────────────────────────────
const ESTADO_TTL_MS = 30000;
const estadoCache = new Map(); // userId → { at, existe, trocouEm, deveTrocar }

async function estadoDaConta(pool, userId) {
  const cached = estadoCache.get(userId);
  if (cached && Date.now() - cached.at < ESTADO_TTL_MS) return cached;
  const r = await pool.query(
    "SELECT password_changed_at, must_change_password FROM users WHERE id = $1",
    [userId],
  );
  const row = r.rows[0];
  const estado = {
    at: Date.now(),
    existe: Boolean(row),
    trocouEm: row?.password_changed_at ? new Date(row.password_changed_at).getTime() : null,
    deveTrocar: Boolean(row?.must_change_password),
  };
  estadoCache.set(userId, estado);
  return estado;
}

const esquecerEstado = (userId) => estadoCache.delete(Number(userId));

/** Token emitido antes da última troca de senha? (iat é em segundos) */
const tokenRevogado = (decoded, estado) =>
  Boolean(estado.trocouEm) && (decoded.iat || 0) < Math.floor(estado.trocouEm / 1000);

/**
 * Grava a senha nova (hash já calculado) e encerra as outras sessões.
 * A hora vem do Node — a mesma régua do `iat` do token emitido em seguida —
 * para um relógio do banco adiantado não derrubar a sessão nova.
 */
async function gravarSenha(db, userId, hash, { limparTrocaObrigatoria = true } = {}) {
  await db.query(
    `UPDATE users
        SET password = $1,
            password_changed_at = $2,
            must_change_password = CASE WHEN $3 THEN FALSE ELSE must_change_password END,
            reset_token = NULL, reset_token_expires = NULL,
            two_factor_code = NULL, two_factor_expires = NULL, two_factor_attempts = 0
      WHERE id = $4`,
    [hash, new Date(Date.now() - 1000), limparTrocaObrigatoria, userId],
  );
  esquecerEstado(userId);
}

/** Lê o usuário do banco e devolve { token, user } prontos para o frontend. */
async function emitirSessao(pool, userId) {
  const r = await pool.query(
    `SELECT u.*, g.name AS group_name
       FROM users u
       LEFT JOIN user_groups g ON g.id = u.group_id
      WHERE u.id = $1`,
    [userId],
  );
  const row = r.rows[0];
  if (!row) return null;

  const token = jwt.sign(
    {
      id: row.id,
      email: row.email,
      role: row.role,
      nome: row.nome,
      nickname: row.nickname,
      avatar_url: row.avatar_url,
      data_admissao: row.data_admissao,
      group_id: row.group_id || null,
      group_name: row.group_name || null,
      must_change_password: Boolean(row.must_change_password),
    },
    process.env.JWT_SECRET,
    { expiresIn: SESSAO_DURACAO },
  );

  const user = semSegredos(row);
  user.permissions = await getGroupPermissions(pool, row.group_id);
  return { token, user };
}

// ── Limite de tentativas ───────────────────────────────────────────────────
// IP do cliente: o primeiro item do X-Forwarded-For (o resto é a cadeia de
// proxies). Pode ser forjado pelo cliente, por isso o limite por e-mail é o
// que segura de verdade; o por IP pega quem testa muitos e-mails.
const ipDoCliente = (req) =>
  String(req.ipAddress || "").split(",")[0].trim() || null;

/**
 * Conta ações recentes no activity_logs.
 * `por`: { email } compara o e-mail digitado (normalizado); { ip } o IP do
 * cliente; { userId } o usuário.
 */
async function excedeuLimite(pool, { acao, minutos, maximo, email, ip, userId }) {
  const filtros = ["action = $1", "created_at > now() - make_interval(mins => $2)"];
  const params = [acao, minutos];
  if (email !== undefined) {
    params.push(email);
    filtros.push(`lower(btrim(user_email)) = $${params.length}`);
  }
  if (ip !== undefined) {
    if (!ip) return false;
    params.push(ip);
    filtros.push(`btrim(split_part(ip_address, ',', 1)) = $${params.length}`);
  }
  if (userId !== undefined) {
    params.push(userId);
    filtros.push(`user_id = $${params.length}`);
  }
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM activity_logs WHERE ${filtros.join(" AND ")}`,
    params,
  );
  return r.rows[0].n >= maximo;
}

module.exports = {
  SENHA_MIN,
  SENHA_MAX,
  semSegredos,
  normalizarEmail,
  validarSenha,
  estadoDaConta,
  esquecerEstado,
  tokenRevogado,
  gravarSenha,
  emitirSessao,
  ipDoCliente,
  excedeuLimite,
};
