const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/auth.js");

module.exports = function (pool) {
  const checkLoggedIn = isLoggedIn(pool);

  // Rota para buscar todas as perguntas de forma aleatória
  router.get("/questions", checkLoggedIn, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, statement_a, type_a, statement_b, type_b FROM enneagram_questions ORDER BY RANDOM()"
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar perguntas." });
    }
  });

  // Rota para buscar o resultado de um utilizador
  router.get("/results", checkLoggedIn, async (req, res) => {
    const { id: userId } = req.user;
    try {
      const result = await pool.query(
        "SELECT * FROM user_enneagram_results WHERE user_id = $1",
        [userId]
      );
      res.json(result.rows[0] || null);
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar resultados." });
    }
  });

  router.get("/types", checkLoggedIn, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM enneagram_types ORDER BY id"
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar tipos do Eneagrama." });
    }
  });

  // Rota para submeter as respostas e calcular o resultado
  router.post("/submit", checkLoggedIn, async (req, res) => {
    const { id: userId } = req.user;
    const { answers } = req.body;

    const scores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    for (const questionId in answers) {
      const chosenType = answers[questionId];
      if (scores.hasOwnProperty(chosenType)) {
        scores[chosenType]++;
      }
    }

    let dominantType = 0;
    let maxScore = -1;
    for (const type in scores) {
      if (scores[type] > maxScore) {
        maxScore = scores[type];
        dominantType = parseInt(type, 10);
      }
    }

    try {
      const query = `
        INSERT INTO user_enneagram_results 
          (user_id, dominant_type, score_1, score_2, score_3, score_4, score_5, score_6, score_7, score_8, score_9, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          dominant_type = EXCLUDED.dominant_type,
          score_1 = EXCLUDED.score_1, score_2 = EXCLUDED.score_2, score_3 = EXCLUDED.score_3,
          score_4 = EXCLUDED.score_4, score_5 = EXCLUDED.score_5, score_6 = EXCLUDED.score_6,
          score_7 = EXCLUDED.score_7, score_8 = EXCLUDED.score_8, score_9 = EXCLUDED.score_9,
          completed_at = NOW()
        RETURNING *;
      `;
      const result = await pool.query(query, [
        userId,
        dominantType,
        scores[1],
        scores[2],
        scores[3],
        scores[4],
        scores[5],
        scores[6],
        scores[7],
        scores[8],
        scores[9],
      ]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao salvar resultado do Eneagrama:", err);
      res.status(500).json({ error: "Erro ao salvar resultado." });
    }
  });

  return router;
};
