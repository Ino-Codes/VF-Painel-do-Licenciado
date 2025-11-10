const express = require("express");
const router = express.Router();

module.exports = function (pool, logActivity) {
  const { isLoggedIn, checkRole } = require("../middleware/auth.js");

  // Rota para listar todas as etapas do processo seletivo
  router.get(
    "/stages",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      try {
        const result = await pool.query(
          "SELECT * FROM recruitment_stages ORDER BY stage_order ASC"
        );
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao buscar etapas:", err);
        res
          .status(500)
          .json({ error: "Erro ao buscar etapas do processo seletivo" });
      }
    }
  );

  // Rota para criar uma nova etapa
  router.post(
    "/stages",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { name, stage_order, pipeline_type } = req.body;
      try {
        // Ajusta a ordem das etapas existentes se necessário
        await pool.query(
          "UPDATE recruitment_stages SET stage_order = stage_order + 1 WHERE stage_order >= $1",
          [stage_order]
        );

        const result = await pool.query(
          "INSERT INTO recruitment_stages (name, stage_order, pipeline_type) VALUES ($1, $2, $3) RETURNING *",
          [name, stage_order, pipeline_type || "Recrutamento"]
        );

        logActivity(
          req.user.id,
          req.user.email,
          "Nova Etapa de Recrutamento",
          `Etapa "${name}" criada no pipeline ${
            pipeline_type || "Recrutamento"
          }`,
          req.ipAddress
        );

        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar etapa:", err);
        res
          .status(500)
          .json({ error: "Erro ao criar etapa do processo seletivo" });
      }
    }
  );

  // Rota para deletar uma etapa
  router.delete(
    "/stage/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Verifica se existem candidatos nessa etapa
        const candidatesCheck = await client.query(
          "SELECT COUNT(*) FROM candidates WHERE stage_id = $1",
          [id]
        );

        if (parseInt(candidatesCheck.rows[0].count) > 0) {
          throw new Error(
            "Não é possível excluir uma etapa que contém candidatos"
          );
        }

        // Busca informações da etapa antes de excluir
        const stageInfo = await client.query(
          "SELECT name, stage_order FROM recruitment_stages WHERE id = $1",
          [id]
        );

        if (stageInfo.rowCount === 0) {
          throw new Error("Etapa não encontrada");
        }

        // Exclui a etapa
        await client.query("DELETE FROM recruitment_stages WHERE id = $1", [
          id,
        ]);

        // Reordena as etapas restantes
        await client.query(
          "UPDATE recruitment_stages SET stage_order = stage_order - 1 WHERE stage_order > $1",
          [stageInfo.rows[0].stage_order]
        );

        await client.query("COMMIT");

        logActivity(
          req.user.id,
          req.user.email,
          "Etapa Excluída",
          `Etapa "${stageInfo.rows[0].name}" foi excluída do pipeline`,
          req.ipAddress
        );

        res.json({ success: true, message: "Etapa excluída com sucesso" });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao excluir etapa:", err);

        if (
          err.message ===
          "Não é possível excluir uma etapa que contém candidatos"
        ) {
          res.status(400).json({ error: err.message });
        } else if (err.message === "Etapa não encontrada") {
          res.status(404).json({ error: err.message });
        } else {
          res.status(500).json({ error: "Erro ao excluir etapa" });
        }
      } finally {
        client.release();
      }
    }
  );

  // Rota para atualizar ordem das etapas (drag-and-drop)
  router.put(
    "/stages/reorder",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { stages } = req.body; // Array de { id, stage_order }
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        for (const stage of stages) {
          await client.query(
            "UPDATE recruitment_stages SET stage_order = $1 WHERE id = $2",
            [stage.stage_order, stage.id]
          );
        }

        await client.query("COMMIT");
        res.json({
          success: true,
          message: "Ordem das etapas atualizada com sucesso",
        });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao reordenar etapas:", err);
        res.status(500).json({ error: "Erro ao reordenar etapas" });
      } finally {
        client.release();
      }
    }
  );

  // Rota para listar candidatos (com filtros e paginação)
  router.get(
    "/candidates",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const {
        search,
        stage_id,
        role_applied_for,
        status,
        page = 1,
        limit = 10,
      } = req.query;

      try {
        const offset = (page - 1) * limit;
        let whereClauses = [];
        const params = [];
        let paramCount = 1;

        if (search) {
          params.push(`%${search}%`);
          whereClauses.push(
            `(c.name ILIKE $${paramCount} OR c.email ILIKE $${paramCount})`
          );
          paramCount++;
        }

        if (stage_id) {
          params.push(stage_id);
          whereClauses.push(`c.stage_id = $${paramCount}`);
          paramCount++;
        }

        if (role_applied_for) {
          params.push(`%${role_applied_for}%`);
          whereClauses.push(`c.role_applied_for ILIKE $${paramCount}`);
          paramCount++;
        }

        if (status) {
          params.push(status);
          whereClauses.push(`c.status = $${paramCount}`);
          paramCount++;
        }

        const whereClause =
          whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

        const countQuery = `
                SELECT COUNT(*) 
                FROM candidates c
                ${whereClause}
            `;

        const candidatesQuery = `
        SELECT 
          c.*,
          rs.name as stage_name,
          rs.stage_order,
          u.nome as responsible_name,
          un.name as unit_name,
                    (
                        SELECT json_agg(json_build_object(
                            'id', ct.id,
                            'task_name', ct.task_name,
                            'is_completed', ct.is_completed,
                            'responsible_user_id', ct.responsible_user_id,
                            'due_date', ct.due_date
                        ))
                        FROM candidate_tasks ct
                        WHERE ct.candidate_id = c.id
                    ) as tasks
        FROM candidates c
        LEFT JOIN recruitment_stages rs ON c.stage_id = rs.id
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN units un ON c.unit_id = un.id
                ${whereClause}
                ORDER BY c.created_at DESC
                LIMIT $${paramCount} OFFSET $${paramCount + 1}
            `;

        const [countResult, candidatesResult] = await Promise.all([
          pool.query(countQuery, params),
          pool.query(candidatesQuery, [...params, limit, offset]),
        ]);

        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
          candidates: candidatesResult.rows,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: parseInt(page),
        });
      } catch (err) {
        console.error("Erro ao buscar candidatos:", err);
        res.status(500).json({ error: "Erro ao buscar candidatos" });
      }
    }
  );

  // Rota para criar um novo candidato
  router.post(
    "/candidates",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { name, email, phone, role_applied_for, stage_id, user_id, tasks } =
        req.body;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Insere o candidato
        const candidateResult = await client.query(
          `INSERT INTO candidates 
                      (name, email, phone, role_applied_for, stage_id, unit_id, user_id) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7) 
                  RETURNING *`,
          [
            name,
            email,
            phone,
            role_applied_for,
            stage_id,
            req.body.unit_id || null,
            user_id,
          ]
        );

        const newCandidate = candidateResult.rows[0];

        // Insere as tarefas do checklist
        if (tasks && tasks.length > 0) {
          for (const task of tasks) {
            await client.query(
              `INSERT INTO candidate_tasks 
                            (candidate_id, task_name, responsible_user_id, due_date) 
                        VALUES ($1, $2, $3, $4)`,
              [
                newCandidate.id,
                task.task_name,
                task.responsible_user_id,
                task.due_date,
              ]
            );
          }
        } else {
          // If no tasks provided, apply default checklist template items
          try {
            const templateRes = await client.query(
              "SELECT id FROM checklist_templates WHERE is_default = true LIMIT 1"
            );
            if (templateRes.rowCount > 0) {
              const templateId = templateRes.rows[0].id;
              const itemsRes = await client.query(
                "SELECT task_name, due_days FROM checklist_template_items WHERE template_id = $1 ORDER BY id",
                [templateId]
              );
              for (const item of itemsRes.rows) {
                // due_days can be used to set a due_date relative to now if needed
                await client.query(
                  `INSERT INTO candidate_tasks (candidate_id, task_name, responsible_user_id, due_date) VALUES ($1, $2, $3, $4)`,
                  [newCandidate.id, item.task_name, null, null]
                );
              }
            }
          } catch (err) {
            console.error("Erro ao aplicar template de checklist:", err);
          }
        }

        await client.query("COMMIT");

        logActivity(
          req.user.id,
          req.user.email,
          "Novo Candidato",
          `Candidato "${name}" cadastrado para a vaga de ${role_applied_for}`,
          req.ipAddress
        );
        res.status(201).json(newCandidate);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao criar candidato:", err);
        res.status(500).json({ error: "Erro ao criar candidato" });
      } finally {
        client.release();
      }
    }
  );

  // Rota para atualizar um candidato
  router.put(
    "/candidates/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const {
        name,
        email,
        phone,
        role_applied_for,
        stage_id,
        status,
        user_id,
        unit_id,
      } = req.body;

      try {
        const result = await pool.query(
          `UPDATE candidates 
                SET name = $1, email = $2, phone = $3, role_applied_for = $4, 
                    stage_id = $5, status = $6, user_id = $7, unit_id = $8 
                WHERE id = $9 
                RETURNING *`,
          [
            name,
            email,
            phone,
            role_applied_for,
            stage_id,
            status,
            user_id,
            unit_id || null,
            id,
          ]
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Candidato não encontrado" });
        }

        logActivity(
          req.user.id,
          req.user.email,
          "Candidato Atualizado",
          `Dados do candidato "${name}" foram atualizados`,
          req.ipAddress
        );

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao atualizar candidato:", err);
        res.status(500).json({ error: "Erro ao atualizar candidato" });
      }
    }
  );

  // Rota para mover um candidato entre etapas (drag-and-drop)
  router.put(
    "/candidates/:id/move",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { stage_id } = req.body;

      try {
        const result = await pool.query(
          "UPDATE candidates SET stage_id = $1 WHERE id = $2 RETURNING *",
          [stage_id, id]
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Candidato não encontrado" });
        }

        logActivity(
          req.user.id,
          req.user.email,
          "Candidato Movido",
          `Candidato movido para nova etapa do processo`,
          req.ipAddress
        );

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao mover candidato:", err);
        res.status(500).json({ error: "Erro ao mover candidato" });
      }
    }
  );

  // Rota para gerenciar tarefas do candidato
  router.post(
    "/candidates/:id/tasks",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { task_name, responsible_user_id, due_date } = req.body;

      try {
        const result = await pool.query(
          `INSERT INTO candidate_tasks 
                    (candidate_id, task_name, responsible_user_id, due_date) 
                VALUES ($1, $2, $3, $4) 
                RETURNING *`,
          [id, task_name, responsible_user_id, due_date]
        );

        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar tarefa:", err);
        res.status(500).json({ error: "Erro ao criar tarefa" });
      }
    }
  );

  // Rota para excluir um candidato
  router.delete(
    "/candidates/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Primeiro, excluir todas as tarefas relacionadas ao candidato
        await client.query(
          "DELETE FROM candidate_tasks WHERE candidate_id = $1",
          [id]
        );

        // Depois, excluir o candidato
        const result = await client.query(
          "DELETE FROM candidates WHERE id = $1 RETURNING name",
          [id]
        );

        if (result.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Candidato não encontrado" });
        }

        await client.query("COMMIT");

        logActivity(
          req.user.id,
          req.user.email,
          "Candidato Excluído",
          `Candidato "${result.rows[0].name}" foi excluído do sistema`,
          req.ipAddress
        );

        res.json({ success: true, message: "Candidato excluído com sucesso" });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao excluir candidato:", err);
        res.status(500).json({ error: "Erro ao excluir candidato" });
      } finally {
        client.release();
      }
    }
  );

  // Rota para atualizar status de uma tarefa
  router.put(
    "/tasks/:taskId",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { taskId } = req.params;
      const { is_completed } = req.body;

      try {
        const result = await pool.query(
          "UPDATE candidate_tasks SET is_completed = $1 WHERE id = $2 RETURNING *",
          [is_completed, taskId]
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Tarefa não encontrada" });
        }

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao atualizar tarefa:", err);
        res.status(500).json({ error: "Erro ao atualizar tarefa" });
      }
    }
  );

  // Rota para deletar uma tarefa do candidato
  router.delete(
    "/tasks/:taskId",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { taskId } = req.params;
      try {
        const result = await pool.query(
          "DELETE FROM candidate_tasks WHERE id = $1 RETURNING *",
          [taskId]
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Tarefa não encontrada" });
        }

        res.json({ success: true, deleted: result.rows[0] });
      } catch (err) {
        console.error("Erro ao deletar tarefa:", err);
        res.status(500).json({ error: "Erro ao deletar tarefa" });
      }
    }
  );

  // --- Checklist templates management (admin RH) ---

  // List templates
  router.get(
    "/checklist-templates",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      try {
        const result = await pool.query(
          "SELECT id, name, is_default, created_at FROM checklist_templates ORDER BY id"
        );
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao buscar templates:", err);
        res.status(500).json({ error: "Erro ao buscar templates" });
      }
    }
  );

  // Create template
  router.post(
    "/checklist-templates",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { name, is_default } = req.body;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (is_default) {
          await client.query(
            "UPDATE checklist_templates SET is_default = false WHERE is_default = true"
          );
        }
        const result = await client.query(
          "INSERT INTO checklist_templates (name, is_default) VALUES ($1, $2) RETURNING *",
          [name, !!is_default]
        );
        await client.query("COMMIT");
        logActivity(
          req.user.id,
          req.user.email,
          "Template Criado",
          `Template de checklist '${name}' criado`,
          req.ipAddress
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao criar template:", err);
        res.status(500).json({ error: "Erro ao criar template" });
      } finally {
        client.release();
      }
    }
  );

  // Update template
  router.put(
    "/checklist-templates/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { name, is_default } = req.body;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (is_default) {
          await client.query(
            "UPDATE checklist_templates SET is_default = false WHERE is_default = true"
          );
        }
        const result = await client.query(
          "UPDATE checklist_templates SET name = $1, is_default = $2 WHERE id = $3 RETURNING *",
          [name, !!is_default, id]
        );
        if (result.rowCount === 0) {
          await client.query("ROLLBACK");
          client.release();
          return res.status(404).json({ error: "Template não encontrado" });
        }
        await client.query("COMMIT");
        logActivity(
          req.user.id,
          req.user.email,
          "Template Editado",
          `Template de checklist '${name}' atualizado`,
          req.ipAddress
        );
        res.json(result.rows[0]);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao atualizar template:", err);
        res.status(500).json({ error: "Erro ao atualizar template" });
      } finally {
        client.release();
      }
    }
  );

  // Delete template
  router.delete(
    "/checklist-templates/:id",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      try {
        const result = await pool.query(
          "DELETE FROM checklist_templates WHERE id = $1 RETURNING *",
          [id]
        );
        if (result.rowCount === 0)
          return res.status(404).json({ error: "Template não encontrado" });
        logActivity(
          req.user.id,
          req.user.email,
          "Template Excluído",
          `Template ID ${id} excluído`,
          req.ipAddress
        );
        res.json({ success: true });
      } catch (err) {
        console.error("Erro ao deletar template:", err);
        res.status(500).json({ error: "Erro ao deletar template" });
      }
    }
  );

  // Items: list/create/update/delete for template items
  router.get(
    "/checklist-templates/:id/items",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      try {
        const result = await pool.query(
          "SELECT id, task_name, due_days FROM checklist_template_items WHERE template_id = $1 ORDER BY id",
          [id]
        );
        res.json(result.rows);
      } catch (err) {
        console.error("Erro ao buscar items:", err);
        res.status(500).json({ error: "Erro ao buscar items" });
      }
    }
  );

  router.post(
    "/checklist-templates/:id/items",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { task_name, due_days } = req.body;
      try {
        const result = await pool.query(
          "INSERT INTO checklist_template_items (template_id, task_name, due_days) VALUES ($1, $2, $3) RETURNING *",
          [id, task_name, due_days || null]
        );
        logActivity(
          req.user.id,
          req.user.email,
          "Item do Template Criado",
          `Item '${task_name}' criado no template ${id}`,
          req.ipAddress
        );
        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar item:", err);
        res.status(500).json({ error: "Erro ao criar item" });
      }
    }
  );

  router.put(
    "/checklist-templates/items/:itemId",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { itemId } = req.params;
      const { task_name, due_days } = req.body;
      try {
        const result = await pool.query(
          "UPDATE checklist_template_items SET task_name = $1, due_days = $2 WHERE id = $3 RETURNING *",
          [task_name, due_days || null, itemId]
        );
        if (result.rowCount === 0)
          return res.status(404).json({ error: "Item não encontrado" });
        logActivity(
          req.user.id,
          req.user.email,
          "Item do Template Editado",
          `Item '${task_name}' atualizado`,
          req.ipAddress
        );
        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao atualizar item:", err);
        res.status(500).json({ error: "Erro ao atualizar item" });
      }
    }
  );

  router.delete(
    "/checklist-templates/items/:itemId",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { itemId } = req.params;
      try {
        const result = await pool.query(
          "DELETE FROM checklist_template_items WHERE id = $1 RETURNING *",
          [itemId]
        );
        if (result.rowCount === 0)
          return res.status(404).json({ error: "Item não encontrado" });
        logActivity(
          req.user.id,
          req.user.email,
          "Item do Template Excluído",
          `Item ID ${itemId} excluído`,
          req.ipAddress
        );
        res.json({ success: true });
      } catch (err) {
        console.error("Erro ao deletar item:", err);
        res.status(500).json({ error: "Erro ao deletar item" });
      }
    }
  );

  return router;
};
