const express = require("express");
const router = express.Router();
const { isAdmin, isLoggedIn, checkRole } = require("../middleware/auth.js");

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

module.exports = function (pool) {
  // Rotas de aluno
  router.get("/course/:courseId", async (req, res) => {
    const { courseId } = req.params;
    try {
      const quizResult = await pool.query(
        "SELECT id, title FROM quizzes WHERE course_id = $1",
        [courseId]
      );
      if (quizResult.rowCount === 0) {
        return res
          .status(404)
          .json({ error: "Quiz não encontrado para este curso." });
      }
      const quiz = quizResult.rows[0];

      const questionsResult = await pool.query(
        "SELECT id, question_text FROM questions WHERE quiz_id = $1 ORDER BY question_order",
        [quiz.id]
      );
      const questions = questionsResult.rows;

      for (const question of questions) {
        const optionsResult = await pool.query(
          "SELECT id, option_text FROM options WHERE question_id = $1",
          [question.id]
        );
        question.options = shuffleArray(optionsResult.rows);
      }
      quiz.questions = questions;
      res.json(quiz);
    } catch (err) {
      console.error("Erro ao buscar quiz:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  // Rota para submeter as respostas do quiz
  router.post("/:quizId/submit", isLoggedIn, async (req, res) => {
    const { quizId } = req.params;
    const { userId, answers } = req.body;

    try {
      const quizInfo = await pool.query(
        "SELECT passing_score FROM quizzes WHERE id = $1",
        [quizId]
      );
      const passingScore = quizInfo.rows[0].passing_score;

      const correctOptionsQuery = `
        SELECT q.id AS question_id, o.id AS correct_option_id
        FROM questions q
        JOIN options o ON q.id = o.question_id
        WHERE q.quiz_id = $1 AND o.is_correct = TRUE;
      `;
      const correctOptionsResult = await pool.query(correctOptionsQuery, [
        quizId,
      ]);

      const correctAnswersMap = new Map();
      correctOptionsResult.rows.forEach((row) => {
        correctAnswersMap.set(
          row.question_id.toString(),
          row.correct_option_id.toString()
        );
      });

      let score = 0;
      const questionIds = Object.keys(answers);

      // CORREÇÃO: Comparamos string com string
      for (const questionId of questionIds) {
        if (
          answers[questionId].toString() === correctAnswersMap.get(questionId)
        ) {
          score++;
        }
      }

      const totalQuestions = correctAnswersMap.size;
      const finalScore =
        totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
      const passed = finalScore >= passingScore;

      await pool.query(
        "INSERT INTO quiz_attempts (user_id, quiz_id, score, passed) VALUES ($1, $2, $3, $4)",
        [userId, quizId, finalScore, passed]
      );

      res.json({
        score: finalScore,
        passed: passed,
        totalQuestions: totalQuestions,
        correctAnswers: score,
      });
    } catch (err) {
      console.error("Erro ao submeter quiz:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  // --- ROTAS DE ADMINISTRAÇÃO ---

  // PERGUNTAS
  router.post("/:quizId/questions", isLoggedIn, isAdmin, async (req, res) => {
    const { quizId } = req.params;
    const { question_text } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO questions (quiz_id, question_text) VALUES ($1, $2) RETURNING *",
        [quizId, question_text]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Erro ao criar pergunta." });
    }
  });

  router.delete(
    "/questions/:questionId",
    isLoggedIn,
    isAdmin,
    async (req, res) => {
      const { questionId } = req.params;
      try {
        await pool.query("DELETE FROM questions WHERE id = $1", [questionId]);
        res.status(204).send();
      } catch (err) {
        res.status(500).json({ error: "Erro ao apagar pergunta." });
      }
    }
  );

  // OPÇÕES
  router.post(
    "/questions/:questionId/options",
    isLoggedIn,
    isAdmin,
    async (req, res) => {
      const { questionId } = req.params;
      const { option_text } = req.body;
      try {
        const result = await pool.query(
          "INSERT INTO options (question_id, option_text, is_correct) VALUES ($1, $2, FALSE) RETURNING *",
          [questionId, option_text]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        res.status(500).json({ error: "Erro ao criar opção." });
      }
    }
  );

  router.put(
    "/options/:optionId/correct",
    isLoggedIn,
    isAdmin,
    async (req, res) => {
      const { optionId } = req.params;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const optionResult = await client.query(
          "SELECT question_id FROM options WHERE id = $1",
          [optionId]
        );
        const { question_id } = optionResult.rows[0];
        await client.query(
          "UPDATE options SET is_correct = FALSE WHERE question_id = $1",
          [question_id]
        );
        await client.query(
          "UPDATE options SET is_correct = TRUE WHERE id = $1",
          [optionId]
        );
        await client.query("COMMIT");
        res.status(200).json({ success: true });
      } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: "Erro ao marcar opção como correta." });
      } finally {
        client.release();
      }
    }
  );

  router.delete("/options/:optionId", isLoggedIn, isAdmin, async (req, res) => {
    const { optionId } = req.params;
    try {
      await pool.query("DELETE FROM options WHERE id = $1", [optionId]);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Erro ao apagar opção." });
    }
  });

  return router;
};
