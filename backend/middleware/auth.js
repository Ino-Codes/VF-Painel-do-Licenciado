const jwt = require("jsonwebtoken");

const isLoggedIn = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Autenticação necessária." });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido ou expirado." });
    }
    req.user = decodedUser;
    next();
  });
};

const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (req.user && allowedRoles.includes(req.user.role)) {
      return next(); // Permite o acesso
    }
    return res.status(403).json({
      error: "Acesso negado. Você não tem permissão para este recurso.",
    });
  };
};

// A função isAdmin agora é apenas um caso específico do checkRole
const isAdmin = checkRole(["admin"]);

module.exports = { isLoggedIn, isAdmin, checkRole };
