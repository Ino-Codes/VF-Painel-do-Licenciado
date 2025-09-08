const express = require("express");
const router = express.Router();
const { isAdmin } = require("../middleware/auth.js");

module.exports = function (pool) {
  const checkAdmin = isAdmin(pool);

  router.get("/enneagram-stats", checkAdmin, async (req, res) => {
    try {
      // 1. Contagem de resultados por tipo de Eneagrama
      const typeCountsQuery = pool.query(
        `SELECT dominant_type, COUNT(*) as count 
         FROM user_enneagram_results 
         GROUP BY dominant_type`
      );

      // 2. Lista de usuários que completaram, com seus tipos
      const completedUsersQuery = pool.query(
        `SELECT u.nome, r.dominant_type 
         FROM user_enneagram_results r 
         JOIN users u ON r.user_id = u.id 
         ORDER BY u.nome ASC`
      );

      // 3. Contagem total de colaboradores
      const totalCollaboratorsQuery = pool.query(
        "SELECT COUNT(*) as total FROM users WHERE role = 'colaborador'"
      );

      // 4. Contagem de colaboradores que completaram o teste
      const completedCollaboratorsQuery = pool.query(
        `SELECT COUNT(*) as completed FROM user_enneagram_results r
         JOIN users u ON r.user_id = u.id
         WHERE u.role = 'colaborador'`
      );

      const [
        typeCountsResult,
        completedUsersResult,
        totalCollaboratorsResult,
        completedCollaboratorsResult,
      ] = await Promise.all([
        typeCountsQuery,
        completedUsersQuery,
        totalCollaboratorsQuery,
        completedCollaboratorsQuery,
      ]);

      const response = {
        typeCounts: typeCountsResult.rows,
        completedUsers: completedUsersResult.rows,
        collaboratorStats: {
          total: parseInt(totalCollaboratorsResult.rows[0].total, 10),
          completed: parseInt(
            completedCollaboratorsResult.rows[0].completed,
            10
          ),
        },
      };

      res.json(response);
    } catch (err) {
      console.error("Erro ao buscar estatísticas do Eneagrama:", err);
      res.status(500).json({ error: "Erro ao buscar estatísticas." });
    }
  });

  return router;
};
