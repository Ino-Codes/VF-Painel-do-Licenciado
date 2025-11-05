// backend/routes/recruitment.js

const express = require("express");
const router = express.Router();
// Importamos os nossos middlewares de autenticação e o novo 'checkRole'
const { isLoggedIn, isAdmin, checkRole } = require("../middleware/auth.js");

// O módulo agora recebe 'pool' e 'createNotification'
module.exports = function (pool, createNotification) {
  // ===============================================
  // ROTAS DE GESTÃO DAS "COLUNAS" (Stages)
  // ===============================================

  console.log("✅ Rotas de recrutamento carregadas");

  // Criar uma nova coluna no Kanban
  router.post(
    "/stage",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { name, pipeline_type = "Recrutamento" } = req.body;
      try {
        // Pega a ordem mais alta e adiciona 1
        const orderResult = await pool.query(
          "SELECT MAX(stage_order) as max_order FROM recruitment_stages WHERE pipeline_type = $1",
          [pipeline_type]
        );
        const newOrder = (orderResult.rows[0].max_order || 0) + 1;

        const result = await pool.query(
          "INSERT INTO recruitment_stages (name, stage_order, pipeline_type) VALUES ($1, $2, $3) RETURNING *",
          [name, newOrder, pipeline_type]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar etapa de recrutamento:", err);
        res.status(500).json({ error: "Erro ao criar etapa." });
      }
    }
  );

  // Listar todas as colunas do Kanban (em ordem)
  router.get(
    "/stages",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { pipeline_type = "Recrutamento" } = req.query;
      try {
        const result = await pool.query(
          "SELECT * FROM recruitment_stages WHERE pipeline_type = $1 ORDER BY stage_order ASC",
          [pipeline_type]
        );
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao buscar etapas:", err);
        res.status(500).json({ error: "Erro ao buscar etapas." });
      }
    }
  );

  // Atualizar a ordem das colunas (para drag-and-drop)
  router.put(
    "/stages/order",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { stageIds } = req.body; // Um array de IDs na nova ordem
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (let i = 0; i < stageIds.length; i++) {
          await client.query(
            "UPDATE recruitment_stages SET stage_order = $1 WHERE id = $2",
            [i + 1, stageIds[i]]
          );
        }
        await client.query("COMMIT");
        res.json({ success: true, message: "Ordem das etapas atualizada." });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao reordenar etapas:", err);
        res.status(500).json({ error: "Erro ao reordenar etapas." });
      } finally {
        client.release();
      }
    }
  );

  // ===============================================
  // ROTAS DE GESTÃO DOS "CARDS" (Candidates)
  // ===============================================

  // Listar todos os candidatos (para preencher o Kanban)
  router.get(
    "/candidates",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      try {
        const result = await pool.query(
          "SELECT * FROM candidates WHERE status = 'Ativo' ORDER BY created_at DESC"
        );
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao buscar candidatos:", err);
        res.status(500).json({ error: "Erro ao buscar candidatos." });
      }
    }
  );

  // Criar um novo candidato (card)
  router.post(
    "/candidate",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { name, email, phone, role_applied_for, stage_id } = req.body;
      try {
        // Pega o ID da primeira coluna, caso nenhum seja fornecido
        let firstStageId = stage_id;
        if (!firstStageId) {
          const stageResult = await pool.query(
            "SELECT id FROM recruitment_stages WHERE stage_order = 1 AND pipeline_type = 'Recrutamento'"
          );
          if (stageResult.rowCount === 0) {
            return res
              .status(400)
              .json({ error: "Nenhuma etapa de recrutamento configurada." });
          }
          firstStageId = stageResult.rows[0].id;
        }

        const result = await pool.query(
          "INSERT INTO candidates (name, email, phone, role_applied_for, stage_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
          [name, email, phone, role_applied_for, firstStageId]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar candidato:", err);
        res.status(500).json({ error: "Erro ao criar candidato." });
      }
    }
  );

  // Mover um candidato (card) entre colunas (drag-and-drop)
  router.put(
    "/candidate/:id/move",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { new_stage_id } = req.body;
      try {
        const result = await pool.query(
          "UPDATE candidates SET stage_id = $1 WHERE id = $2 RETURNING *",
          [new_stage_id, id]
        );
        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao mover candidato:", err);
        res.status(500).json({ error: "Erro ao mover candidato." });
      }
    }
  );

  // ===============================================
  // ROTAS DE GESTÃO DAS "TAREFAS" (Checklist)
  // ===============================================

  // Listar tarefas de um candidato
  router.get("/candidate/:id/tasks", isLoggedIn, async (req, res) => {
    const { id } = req.params;
    try {
      const query = `
        SELECT t.*, u.nome as responsible_user_name
        FROM candidate_tasks t
        LEFT JOIN users u ON t.responsible_user_id = u.id
        WHERE t.candidate_id = $1
        ORDER BY t.id ASC
      `;
      const result = await pool.query(query, [id]);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar tarefas do candidato:", err);
      res.status(500).json({ error: "Erro ao buscar tarefas." });
    }
  });

  // Adicionar uma nova tarefa ao checklist do candidato
  router.post(
    "/candidate/:id/tasks",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id: candidate_id } = req.params;
      const { task_name, responsible_user_id, due_date } = req.body;
      try {
        const result = await pool.query(
          "INSERT INTO candidate_tasks (candidate_id, task_name, responsible_user_id, due_date) VALUES ($1, $2, $3, $4) RETURNING *",
          [
            candidate_id,
            task_name,
            responsible_user_id || null,
            due_date || null,
          ]
        );
        const newTaskId = result.rows[0].id;

        // Notifica o responsável pela tarefa (se houver um)
        if (responsible_user_id) {
          const candidate = await pool.query(
            "SELECT name FROM candidates WHERE id = $1",
            [candidate_id]
          );
          const message = `Nova tarefa de onboarding para: ${candidate.rows[0].name}.`;
          // Link para a futura página "Minhas Tarefas"
          createNotification(responsible_user_id, message, "/minhas-tarefas");
        }

        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar tarefa:", err);
        res.status(500).json({ error: "Erro ao criar tarefa." });
      }
    }
  );

  // Marcar uma tarefa como concluída/não concluída
  router.put("/task/:taskId", isLoggedIn, async (req, res) => {
    const { taskId } = req.params;
    const { is_completed } = req.body;
    try {
      const result = await pool.query(
        "UPDATE candidate_tasks SET is_completed = $1, completed_at = $2 WHERE id = $3 RETURNING *",
        [is_completed, is_completed ? new Date() : null, taskId]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao atualizar tarefa:", err);
      res.status(500).json({ error: "Erro ao atualizar tarefa." });
    }
  });

  router.use((req, res, next) => {
    console.log("REQ USER:", req.user);
    next();
  });

  return router;
};
