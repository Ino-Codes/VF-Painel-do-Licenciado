const express = require("express");
const router = express.Router();
const { isLoggedIn, checkPermission } = require("../middleware/auth.js");

module.exports = function (pool, createNotification, logActivity) {
  // Busca os temas de feedback
  router.get("/themes", isLoggedIn, checkPermission("feedbacks.view"), async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM feedback_themes ORDER BY name ASC",
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar temas:", err);
      res.status(500).json({ error: "Erro ao buscar temas." });
    }
  });

  // Cria novo tema
  router.post(
    "/themes",
    isLoggedIn,
    checkPermission("feedbacks.manage"),
    async (req, res) => {
      const { name, description } = req.body;
      try {
        const result = await pool.query(
          "INSERT INTO feedback_themes (name, description) VALUES ($1, $2) RETURNING *",
          [name, description],
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar tema:", err);
        if (err.code === "23505") {
          // Unique violation
          return res
            .status(409)
            .json({ error: "Já existe um tema com este nome." });
        }
        res.status(500).json({ error: "Erro ao criar tema." });
      }
    },
  );

  // Busca todos os feedbacks
  router.get("/", isLoggedIn, checkPermission("feedbacks.view"), async (req, res) => {
    const { id: userId } = req.user;
    const canManageAll =
      Array.isArray(req.user.permissions) &&
      req.user.permissions.includes("feedbacks.manage");
    const { type, status } = req.query;

    try {
      let query = `
        SELECT f.*,
               creator.nome as creator_name,
               evaluator.nome as evaluator_name,
               target.nome as target_name
        FROM feedbacks f
        JOIN users creator ON f.created_by_user_id = creator.id
        JOIN users evaluator ON f.evaluator_user_id = evaluator.id
        LEFT JOIN users target ON f.target_user_id = target.id
      `;

      const params = [];
      const conditions = [];

      if (!canManageAll) {
        // Colaborador vê se for o Criador, o Alvo OU o Avaliador
        conditions.push(
          `(f.target_user_id = $${
            params.length + 1
          } OR f.created_by_user_id = $${
            params.length + 1
          } OR f.evaluator_user_id = $${params.length + 1})`,
        );
        params.push(userId);
      }

      if (type) {
        conditions.push(`f.type = $${params.length + 1}`);
        params.push(type);
      }

      if (status) {
        conditions.push(`f.status = $${params.length + 1}`);
        params.push(status);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " ORDER BY f.created_at DESC";

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao listar feedbacks:", err);
      res.status(500).json({ error: "Erro ao listar feedbacks." });
    }
  });

  // Busca o preenchimento do feedback
  router.get("/:id", isLoggedIn, checkPermission("feedbacks.view"), async (req, res) => {
    const { id } = req.params;
    const { id: userId } = req.user;
    const canManageAll =
      Array.isArray(req.user.permissions) &&
      req.user.permissions.includes("feedbacks.manage");

    try {
      const feedbackResult = await pool.query(
        `
        SELECT f.*, 
               creator.nome as creator_name, 
               evaluator.nome as evaluator_name,
               target.nome as target_name
        FROM feedbacks f
        JOIN users creator ON f.created_by_user_id = creator.id
        JOIN users evaluator ON f.evaluator_user_id = evaluator.id
        LEFT JOIN users target ON f.target_user_id = target.id
        WHERE f.id = $1
      `,
        [id],
      );

      if (feedbackResult.rowCount === 0)
        return res.status(404).json({ error: "Feedback não encontrado." });

      const feedback = feedbackResult.rows[0];

      if (
        !canManageAll &&
        feedback.target_user_id !== userId &&
        feedback.evaluator_user_id !== userId
      ) {
        return res.status(403).json({ error: "Acesso negado." });
      }

      const entriesResult = await pool.query(
        `
        SELECT fe.*, t.name as theme_name
        FROM feedback_entries fe
        JOIN feedback_themes t ON fe.theme_id = t.id
        WHERE fe.feedback_id = $1
      `,
        [id],
      );

      res.json({ ...feedback, entries: entriesResult.rows });
    } catch (err) {
      console.error("Erro ao buscar detalhes do feedback:", err);
      res.status(500).json({ error: "Erro ao buscar detalhes." });
    }
  });

  // Cria o convite de feedback por parte do RH
  router.post("/", isLoggedIn, checkPermission("feedbacks.manage"), async (req, res) => {
    const { evaluator_user_id, scheduled_at, message, type } = req.body;
    const created_by = req.user.id;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const finalScheduledAt = scheduled_at ? scheduled_at : null;
      const initialStatus = finalScheduledAt ? "Agendado" : "Pendente";

      const result = await client.query(
        `INSERT INTO feedbacks (created_by_user_id, evaluator_user_id, status, scheduled_at) 
        VALUES ($1, $2, $3, $4) RETURNING *`,
        [created_by, evaluator_user_id, initialStatus, finalScheduledAt],
      );

      const newFeedback = result.rows[0];

      const targetUser = await client.query(
        "SELECT nome FROM users WHERE id = $1",
        [evaluator_user_id],
      );

      const targetName =
        targetUser.rows.length > 0 ? targetUser.rows[0].nome : "Colaborador";

      let notifyMsg = "";
      if (initialStatus === "Agendado") {
        const dateStr = new Date(finalScheduledAt).toLocaleDateString("pt-BR");
        const timeStr = new Date(finalScheduledAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        notifyMsg = `Olá ${targetName}, o RH agendou uma reunião de feedback com você para ${dateStr} às ${timeStr}.`;
      } else {
        notifyMsg = `Olá ${targetName}, o RH solicitou que você preencha um feedback.`;
      }

      if (message) notifyMsg += ` Mensagem: "${message}"`;

      createNotification(evaluator_user_id, notifyMsg, "/#");

      await client.query("COMMIT");

      // CORREÇÃO: Uso de req.user.email ao invés de evaluator.nome
      logActivity(
        req.user.id,
        req.user.email,
        "Feedback Iniciado",
        `Iniciou feedback ID ${newFeedback.id} (Criado por: ${req.user.email} -> Para: ${targetName})`,
        req.ipAddress,
      );

      res.status(201).json(newFeedback);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Erro ao criar feedback:", err);
      res.status(500).json({ error: "Erro ao iniciar processo de feedback." });
    } finally {
      client.release();
    }
  });

  // Edição do convite de feedback para respondê-lo e finalizá-lo
  router.put(
    "/:id/submit",
    isLoggedIn,
    checkPermission("feedbacks.manage"),
    async (req, res) => {
      const { id } = req.params;
      const { target_user_id, general_comments, entries } = req.body;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const feedbackCheck = await client.query(
          "SELECT * FROM feedbacks WHERE id = $1",
          [id],
        );

        if (feedbackCheck.rowCount === 0) {
          throw new Error("Feedback não encontrado.");
        }

        const feedback = feedbackCheck.rows[0];

        if (feedback.status === "Concluído") {
          return res
            .status(400)
            .json({ error: "Este feedback já foi finalizado." });
        }

        await client.query(
          `UPDATE feedbacks 
           SET target_user_id = $1, 
               general_comments = $2, 
               status = 'Concluído', 
               updated_at = NOW() 
           WHERE id = $3`,
          [target_user_id, general_comments, id],
        );

        await client.query(
          "DELETE FROM feedback_entries WHERE feedback_id = $1",
          [id],
        );

        if (entries && entries.length > 0) {
          for (const entry of entries) {
            if (entry.theme_id) {
              await client.query(
                `INSERT INTO feedback_entries (feedback_id, theme_id, positive_points, improvement_points)
                   VALUES ($1, $2, $3, $4)`,
                [
                  id,
                  entry.theme_id,
                  entry.positive_points,
                  entry.improvement_points,
                ],
              );
            }
          }
        }

        await client.query("COMMIT");

        // CORREÇÃO: Uso de req.user.email
        logActivity(
          req.user.id,
          req.user.email,
          "Feedback Finalizado",
          `Finalizou feedback ID ${id} (Responsável: ${req.user.email} -> Alvo ID: ${target_user_id})`,
          req.ipAddress,
        );

        res.json({
          success: true,
          message: "Feedback registrado com sucesso.",
        });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao salvar feedback:", err);
        res
          .status(500)
          .json({ error: err.message || "Erro ao salvar feedback." });
      } finally {
        client.release();
      }
    },
  );

  // Exclui um feedback
  router.delete(
    "/:id",
    isLoggedIn,
    checkPermission("feedbacks.manage"),
    async (req, res) => {
      const { id } = req.params;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const feedbackCheck = await client.query(
          "SELECT * FROM feedbacks WHERE id = $1",
          [id],
        );
        if (feedbackCheck.rowCount === 0) {
          throw new Error("Feedback não encontrado.");
        }

        const feedbackData = feedbackCheck.rows[0]; // Dados para o log

        await client.query("DELETE FROM feedbacks WHERE id = $1", [id]);

        await client.query("COMMIT");

        // CORREÇÃO: Uso dos dados buscados anteriormente
        logActivity(
          req.user.id,
          req.user.email,
          "Feedback Excluído",
          `Excluiu feedback ID ${id} (Avaliador ID: ${feedbackData.evaluator_user_id})`,
          req.ipAddress,
        );

        res.json({ success: true, message: "Feedback excluído com sucesso." });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao excluir feedback:", err);
        res.status(500).json({ error: "Erro ao excluir feedback." });
      } finally {
        client.release();
      }
    },
  );

  return router;
};
