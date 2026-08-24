const express = require("express");
const router = express.Router();
const { isLoggedIn, checkPermission } = require("../middleware/auth.js");

module.exports = function (pool) {
  router.get("/", isLoggedIn, checkPermission("logs.view"), async (req, res) => {
    const { page = 1, limit = 20, search } = req.query;
    try {
      const offset = (page - 1) * limit;

      let whereClause = "";
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        whereClause = `WHERE user_email ILIKE $1 OR action ILIKE $1 OR details ILIKE $1 OR to_char(created_at, 'DD/MM/YYYY HH24:MI') ILIKE $1`;
      }

      const countSql = `SELECT COUNT(*) FROM activity_logs ${whereClause}`;

      const queryParams = [...params];
      queryParams.push(limit, offset);

      const limitOffsetParamIndex = params.length + 1;
      const logsSql = `SELECT * FROM activity_logs ${whereClause} ORDER BY created_at DESC LIMIT $${limitOffsetParamIndex} OFFSET $${
        limitOffsetParamIndex + 1
      }`;

      const [countResult, logsResult] = await Promise.all([
        pool.query(countSql, params),
        pool.query(logsSql, queryParams),
      ]);

      const totalCount = parseInt(countResult.rows[0].count, 10);
      res.json({
        logs: logsResult.rows,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      });
    } catch (err) {
      console.error("Erro ao buscar logs de atividade:", err);
      res.status(500).json({ error: "Erro ao buscar logs." });
    }
  });

  return router;
};
