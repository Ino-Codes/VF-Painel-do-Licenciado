const jwt = require("jsonwebtoken");
const { resolvePermissions } = require("../permissionCache.js");

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
