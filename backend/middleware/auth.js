// backend/middleware/auth.js

const jwt = require("jsonwebtoken");

const isLoggedIn = (pool) => (req, res, next) => {
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

const isAdmin = (pool) => (req, res, next) => {
  // --- ADICIONE ESTA LINHA PARA DEPURAÇÃO ---
  console.log(
    "Verificando permissão de Admin. Conteúdo de req.user:",
    req.user
  );
  // --- FIM DA LINHA DE DEPURAÇÃO ---

  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res
    .status(403)
    .json({ error: "Acesso negado. Recurso para administradores." });
};

module.exports = { isLoggedIn, isAdmin };
