// Este middleware verifica se o user_id enviado pertence a um usuário logado
const isLoggedIn = (pool) => async (req, res, next) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({ error: "Autenticação necessária." });
  }

  try {
    const userResult = await pool.query(
      "SELECT id, role FROM users WHERE id = $1",
      [userId]
    );
    if (userResult.rowCount === 0) {
      return res.status(401).json({ error: "Usuário não encontrado." });
    }
    // Anexa o usuário na requisição para uso posterior
    req.user = userResult.rows[0];
    next();
  } catch (err) {
    console.error("Erro no middleware isLoggedIn:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
};

// Este middleware verifica se o user_id enviado pertence a um admin
const isAdmin = (pool) => async (req, res, next) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({ error: "Autenticação necessária." });
  }

  try {
    const userResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [userId]
    );
    const user = userResult.rows[0];

    if (!user || user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Acesso negado. Requer permissão de administrador." });
    }

    // Anexa o usuário na requisição para uso posterior
    req.user = { id: userId, role: user.role };
    next();
  } catch (err) {
    console.error("Erro no middleware isAdmin:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
};

// Exporta ambas as funções
module.exports = { isAdmin, isLoggedIn };
