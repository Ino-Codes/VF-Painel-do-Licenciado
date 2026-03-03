const express = require("express");
const router = express.Router();

const { isLoggedIn, isAdmin, checkRole } = require("../middleware/auth.js");
const { sendEventNotifications } = require("../cron.js");

// Unificamos as funções aqui recebendo pool e resend
module.exports = function (pool, resend) {
  // --- ESTATÍSTICAS AO VIVO ---
  router.get(
    "/system-usage",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      try {
        // 1. Logins hoje
        const todayLoginsQuery = pool.query(`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM activity_logs
        WHERE action = 'Login Bem-Sucedido'
          AND created_at::date = CURRENT_DATE
      `);

        // 2. Total de colaboradores cadastrados
        const totalUsersQuery = pool.query(`
        SELECT COUNT(*) as count FROM users WHERE role != 'licenciado'
      `);

        // 3. Total de licenciados cadastrados
        const totalLicenciadosQuery = pool.query(`
        SELECT COUNT(*) as count FROM users WHERE role = 'licenciado'
      `);

        // 4. Total de downloads de arquivos
        const totalDownloadsQuery = pool.query(`
        SELECT COUNT(*) as count FROM activity_logs WHERE action = 'Arquivo Baixado'
      `);

        // 5. Top 5 arquivos mais baixados
        const topDownloadsQuery = pool.query(`
        SELECT 
          SUBSTRING(details FROM 'baixou o arquivo (.*)') as filename, 
          COUNT(*) as count 
        FROM activity_logs 
        WHERE action = 'Arquivo Baixado' 
        GROUP BY filename
        ORDER BY count DESC 
        LIMIT 5
      `);

        const [
          todayLoginsRes,
          totalUsersRes,
          totalLicenciadosRes,
          totalDownloadsRes,
          topDownloadsRes,
        ] = await Promise.all([
          todayLoginsQuery,
          totalUsersQuery,
          totalLicenciadosQuery,
          totalDownloadsQuery,
          topDownloadsQuery,
        ]);

        const stats = {
          todayLogins: parseInt(todayLoginsRes.rows[0].count, 10),
          totalInternalUsers: parseInt(totalUsersRes.rows[0].count, 10),
          totalLicenciados: parseInt(totalLicenciadosRes.rows[0].count, 10),
          totalDownloads: parseInt(totalDownloadsRes.rows[0].count, 10),
          topDownloads: topDownloadsRes.rows.map((row) => ({
            name: row.filename || "Arquivo Desconhecido",
            count: parseInt(row.count, 10),
          })),
        };

        res.json(stats);
      } catch (err) {
        console.error("Erro ao buscar estatísticas de uso:", err);
        res.status(500).json({ error: "Erro ao buscar estatísticas." });
      }
    },
  );

  router.get(
    "/enneagram-stats",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      try {
        const typeCountsQuery = pool.query(
          `SELECT dominant_type, COUNT(*) as count 
         FROM user_enneagram_results 
         GROUP BY dominant_type`,
        );

        const completedUsersQuery = pool.query(
          `SELECT u.nome, u.setor, r.dominant_type 
         FROM user_enneagram_results r 
         JOIN users u ON r.user_id = u.id 
         ORDER BY u.nome ASC`,
        );

        const totalCollaboratorsQuery = pool.query(
          "SELECT COUNT(*) as total FROM users WHERE role != 'licenciado'",
        );

        const completedCollaboratorsQuery = pool.query(
          `SELECT COUNT(*) as completed FROM user_enneagram_results r
         JOIN users u ON r.user_id = u.id
         WHERE u.role != 'licenciado'`,
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
              10,
            ),
          },
        };

        res.json(response);
      } catch (err) {
        console.error("Erro ao buscar estatísticas do Eneagrama:", err);
        res.status(500).json({ error: "Erro ao buscar estatísticas." });
      }
    },
  );

  router.get(
    "/trigger-email-test",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      console.log(
        "ROTA DE TESTE: Disparando manualmente o envio de emails de eventos...",
      );
      try {
        await sendEventNotifications(resend);
        res
          .status(200)
          .send(
            "Tarefa de notificação de eventos executada manualmente com sucesso. Verifique os logs e a sua caixa de entrada.",
          );
      } catch (error) {
        console.error(
          "ROTA DE TESTE: Erro ao executar a tarefa manualmente.",
          error,
        );
        res.status(500).send("Ocorreu um erro ao executar a tarefa.");
      }
    },
  );

  router.get(
    "/course-engagement",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      try {
        const query = `
      SELECT
        u.nome,
        u.avatar_url,
        COUNT(p.id)::int AS completed_lessons_count
      FROM
        progress p
      JOIN
        users u ON p.user_id = u.id
      WHERE
        u.role != 'licenciado' 
      GROUP BY
        u.id, u.nome, u.avatar_url
      ORDER BY
        completed_lessons_count DESC
      LIMIT 3;
    `;

        const result = await pool.query(query);
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao buscar engajamento de cursos:", err);
        res.status(500).json({ error: "Erro ao buscar dados de engajamento." });
      }
    },
  );

  return router;
};
