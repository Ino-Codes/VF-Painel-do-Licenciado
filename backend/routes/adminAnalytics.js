const express = require("express");
const router = express.Router();

const { isLoggedIn, isAdmin, checkRole } = require("../middleware/auth.js");
const { sendEventNotifications } = require("../cron.js");

module.exports = function (pool) {
  router.get(
    "/enneagram-stats",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      try {
        const typeCountsQuery = pool.query(
          `SELECT dominant_type, COUNT(*) as count 
         FROM user_enneagram_results 
         GROUP BY dominant_type`
        );

        const completedUsersQuery = pool.query(
          `SELECT u.nome, u.setor, r.dominant_type 
         FROM user_enneagram_results r 
         JOIN users u ON r.user_id = u.id 
         ORDER BY u.nome ASC`
        );

        const totalCollaboratorsQuery = pool.query(
          "SELECT COUNT(*) as total FROM users WHERE role != 'licenciado'"
        );

        const completedCollaboratorsQuery = pool.query(
          `SELECT COUNT(*) as completed FROM user_enneagram_results r
         JOIN users u ON r.user_id = u.id
         WHERE u.role != 'licenciado'`
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
    }
  );

  router.get(
    "/trigger-email-test",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      console.log(
        "ROTA DE TESTE: Disparando manualmente o envio de emails de eventos..."
      );
      try {
        await sendEventNotifications();
        res
          .status(200)
          .send(
            "Tarefa de notificação de eventos executada manualmente com sucesso. Verifique os logs e a sua caixa de entrada."
          );
      } catch (error) {
        console.error(
          "ROTA DE TESTE: Erro ao executar a tarefa manualmente.",
          error
        );
        res.status(500).send("Ocorreu um erro ao executar a tarefa.");
      }
    }
  );

  return router;
};
