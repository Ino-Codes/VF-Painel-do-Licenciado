const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/auth.js");

module.exports = function (pool) {
  // Rota para listar os certificados do usuário
  router.get("/user/:userId", isLoggedIn, async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await pool.query(
        `SELECT 
            c.id AS certificate_id, 
            c.course_id, 
            c.issue_date, 
            c.expiration_date, 
            c.certificate_url,
            co.title AS course_title,
            co.description AS course_description
         FROM certificates c
         JOIN courses co ON c.course_id = co.id
         WHERE c.user_id = $1
         ORDER BY c.issue_date DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar certificados do utilizador:", err);
      res.status(500).json({ error: "Erro ao buscar certificados" });
    }
  });

  return router;
};
