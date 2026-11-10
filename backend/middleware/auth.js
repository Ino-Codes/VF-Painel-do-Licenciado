const jwt = require("jsonwebtoken");
const { resolvePermissions } = require("../permissionCache.js");
const { estadoDaConta, tokenRevogado } = require("../authSession.js");

// Únicas rotas liberadas enquanto o usuário não troca a senha do 1º acesso.
const ROTAS_DURANTE_TROCA = new Set([
  "/api/users/force-change-password",
  "/api/auth/me",
]);

// Pool injetado no boot (app.js) para o isLoggedIn resolver permissões.
let _pool = null;
function initAuth(pool) {
  _pool = pool;
}

const isLoggedIn = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Autenticação necessária." });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, async (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido ou expirado." });
    }
    // Conta excluída, senha trocada depois deste token, ou troca de senha
    // obrigatória ainda pendente. Se o banco falhar, segue (as rotas falham
    // de qualquer jeito) — não derruba todo mundo por um erro passageiro.
    try {
      const estado = await estadoDaConta(_pool, decodedUser.id);
      if (!estado.existe || tokenRevogado(decodedUser, estado)) {
        return res.status(401).json({
          error: "Sua sessão foi encerrada. Faça o login novamente.",
          code: "SESSAO_ENCERRADA",
        });
      }
      const rota = `${req.baseUrl}${req.path}`;
      if (estado.deveTrocar && !ROTAS_DURANTE_TROCA.has(rota)) {
        return res.status(403).json({
          error: "Defina uma nova senha para continuar.",
          code: "TROCA_DE_SENHA_OBRIGATORIA",
        });
      }
    } catch (e) {
      console.error("Erro ao verificar o estado da conta:", e.message);
    }

    req.user = decodedUser;
    // Resolve as permissões do grupo (via cache). Fallback para role legado
    // (tokens antigos) tratado dentro de resolvePermissions.
    try {
      req.user.permissions = await resolvePermissions(_pool, decodedUser);
    } catch (e) {
      console.error("Erro ao resolver permissões:", e.message);
      req.user.permissions = Array.isArray(decodedUser.permissions)
        ? decodedUser.permissions
        : [];
    }
    next();
  });
};

// Exige uma permissão específica (ex.: "users.manage").
const checkPermission = (key) => {
  return (req, res, next) => {
    if (req.user && Array.isArray(req.user.permissions) && req.user.permissions.includes(key)) {
      return next();
    }
    return res.status(403).json({
      error: "Acesso negado. Você não tem permissão para este recurso.",
    });
  };
};

// Exige ao menos uma das permissões informadas.
const checkAnyPermission = (keys) => {
  return (req, res, next) => {
    if (
      req.user &&
      Array.isArray(req.user.permissions) &&
      keys.some((k) => req.user.permissions.includes(k))
    ) {
      return next();
    }
    return res.status(403).json({
      error: "Acesso negado. Você não tem permissão para este recurso.",
    });
  };
};

module.exports = {
  initAuth,
  isLoggedIn,
  checkPermission,
  checkAnyPermission,
};
