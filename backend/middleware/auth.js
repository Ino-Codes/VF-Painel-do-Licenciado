// Este middleware simples verifica se o user_id enviado pertence a um admin
const isAdmin = (pool) => async (req, res, next) => {
  // O frontend precisará enviar o ID do usuário em um header, ex: 'x-user-id'
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

    // Se o usuário é um admin, anexa os dados do usuário na requisição e continua
    req.user = { id: userId, role: user.role };
    next();
  } catch (err) {
    console.error("Erro no middleware de autenticação:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
};

module.exports = { isAdmin };
