// backend/routes/projects.js
const express = require("express");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

module.exports = function (pool, logActivity) {
  // ─── Helper: roles com acesso à Área Interna ─────────────────────────────
  const INTERNAL_ROLES = ["admin", "rh", "comercial", "operacional"];

  const isInternal = (role) => INTERNAL_ROLES.includes(role);

  // ─── GET /api/projects ────────────────────────────────────────────────────
  // Todos os internos podem listar
  router.get("/", isLoggedIn, async (req, res) => {
    const { role } = req.user;

    if (!isInternal(role)) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    try {
      const result = await pool.query(`
        SELECT
          p.*,
          u.nome AS creator_name,
          co.name AS company_name,
          co.slug AS company_slug
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN companies co ON p.company_id = co.id
        ORDER BY p.created_at DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao listar projetos:", err);
      res.status(500).json({ error: "Erro ao listar projetos." });
    }
  });

  // ─── GET /api/projects/:id ────────────────────────────────────────────────
  router.get("/:id", isLoggedIn, async (req, res) => {
    const { role } = req.user;
    const { id } = req.params;

    if (!isInternal(role)) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    try {
      const result = await pool.query(
        `
        SELECT
          p.*,
          u.nome AS creator_name,
          co.name AS company_name,
          co.slug AS company_slug
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN companies co ON p.company_id = co.id
        WHERE p.id = $1
      `,
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Projeto não encontrado." });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao buscar projeto:", err);
      res.status(500).json({ error: "Erro ao buscar projeto." });
    }
  });

  // ─── POST /api/projects ───────────────────────────────────────────────────
  // Apenas admin pode criar
  router.post("/", isLoggedIn, checkRole(["admin"]), async (req, res) => {
    const { name, team, description, company_id } = req.body;
    const createdBy = req.user.id;

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ error: "O nome do projeto é obrigatório." });
    }

    try {
      const result = await pool.query(
        `
        INSERT INTO projects (name, team, description, company_id, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
        [
          name.trim(),
          team || null,
          description || null,
          company_id || null,
          createdBy,
        ],
      );

      try {
        await logActivity(
          req.user.id,
          req.user.email,
          "Projeto Criado",
          `Projeto "${name}" criado.`,
          req.ipAddress,
        );
      } catch (e) {
        console.warn("[projects] Falha ao registrar log:", e);
      }

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao criar projeto:", err);
      res.status(500).json({ error: "Erro ao criar projeto." });
    }
  });

  // ─── PUT /api/projects/:id ────────────────────────────────────────────────
  // Apenas admin pode editar
  router.put("/:id", isLoggedIn, checkRole(["admin"]), async (req, res) => {
    const { id } = req.params;
    const { name, team, description, company_id } = req.body;

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ error: "O nome do projeto é obrigatório." });
    }

    try {
      const result = await pool.query(
        `
        UPDATE projects
        SET
          name = $1,
          team = $2,
          description = $3,
          company_id = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `,
        [
          name.trim(),
          team || null,
          description || null,
          company_id || null,
          id,
        ],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Projeto não encontrado." });
      }

      try {
        await logActivity(
          req.user.id,
          req.user.email,
          "Projeto Editado",
          `Projeto ID ${id} atualizado.`,
          req.ipAddress,
        );
      } catch (e) {
        console.warn("[projects] Falha ao registrar log:", e);
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Erro ao editar projeto:", err);
      res.status(500).json({ error: "Erro ao editar projeto." });
    }
  });

  // ─── DELETE /api/projects/:id ─────────────────────────────────────────────
  // Apenas admin pode excluir
  router.delete("/:id", isLoggedIn, checkRole(["admin"]), async (req, res) => {
    const { id } = req.params;

    try {
      const check = await pool.query(
        "SELECT name FROM projects WHERE id = $1",
        [id],
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: "Projeto não encontrado." });
      }

      await pool.query("DELETE FROM projects WHERE id = $1", [id]);

      try {
        await logActivity(
          req.user.id,
          req.user.email,
          "Projeto Excluído",
          `Projeto "${check.rows[0].name}" (ID ${id}) excluído.`,
          req.ipAddress,
        );
      } catch (e) {
        console.warn("[projects] Falha ao registrar log:", e);
      }

      res.json({ success: true, message: "Projeto excluído com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir projeto:", err);
      res.status(500).json({ error: "Erro ao excluir projeto." });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TASKS DO CRONOGRAMA
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GET /api/projects/:id/tasks ─────────────────────────────────────────
  router.get("/:id/tasks", isLoggedIn, async (req, res) => {
    const { role } = req.user;
    const { id } = req.params;

    if (!isInternal(role)) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    try {
      const result = await pool.query(
        `
        SELECT *
        FROM project_tasks
        WHERE project_id = $1
        ORDER BY order_index ASC, start_date ASC
      `,
        [id],
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao listar tarefas:", err);
      res.status(500).json({ error: "Erro ao listar tarefas." });
    }
  });

  // ─── POST /api/projects/:id/tasks ────────────────────────────────────────
  router.post(
    "/:id/tasks",
    isLoggedIn,
    checkRole(["admin"]),
    async (req, res) => {
      const { id } = req.params;
      const {
        name,
        start_year,
        start_month,
        end_year,
        end_month,
        color,
        order_index,
      } = req.body;

      if (!name || !start_year || !start_month || !end_year || !end_month) {
        return res.status(400).json({
          error: "Nome, mês/ano de início e mês/ano de fim são obrigatórios.",
        });
      }

      try {
        // opcional: montar datas apenas como "primeiro dia do mês"
        const startDate = new Date(start_year, start_month - 1, 1);
        const endDate = new Date(end_year, end_month - 1, 1);

        const result = await pool.query(
          `
      INSERT INTO project_tasks (
        project_id,
        name,
        start_date,
        end_date,
        start_year,
        start_month,
        end_year,
        end_month,
        color,
        order_index
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `,
          [
            id,
            name.trim(),
            startDate,
            endDate,
            start_year,
            start_month,
            end_year,
            end_month,
            color || "#d09829",
            order_index ?? 0,
          ],
        );

        res.status(201).json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao criar tarefa:", err);
        res.status(500).json({ error: "Erro ao criar tarefa." });
      }
    },
  );

  // ─── PUT /api/projects/:id/tasks/:taskId ─────────────────────────────────
  router.put(
    "/:id/tasks/:taskId",
    isLoggedIn,
    checkRole(["admin"]),
    async (req, res) => {
      const { taskId } = req.params;
      const {
        name,
        start_year,
        start_month,
        end_year,
        end_month,
        color,
        order_index,
      } = req.body;

      if (!name || !start_year || !start_month || !end_year || !end_month) {
        return res.status(400).json({
          error: "Nome, mês/ano de início e mês/ano de fim são obrigatórios.",
        });
      }

      try {
        const startDate = new Date(start_year, start_month - 1, 1);
        const endDate = new Date(end_year, end_month - 1, 1);

        const result = await pool.query(
          `
      UPDATE project_tasks
      SET
        name        = $1,
        start_date  = $2,
        end_date    = $3,
        start_year  = $4,
        start_month = $5,
        end_year    = $6,
        end_month   = $7,
        color       = $8,
        order_index = $9
      WHERE id = $10
      RETURNING *
    `,
          [
            name.trim(),
            startDate,
            endDate,
            start_year,
            start_month,
            end_year,
            end_month,
            color || "#d09829",
            order_index ?? 0,
            taskId,
          ],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Tarefa não encontrada." });
        }

        res.json(result.rows[0]);
      } catch (err) {
        console.error("Erro ao editar tarefa:", err);
        res.status(500).json({ error: "Erro ao editar tarefa." });
      }
    },
  );

  // ─── DELETE /api/projects/:id/tasks/:taskId ───────────────────────────────
  router.delete(
    "/:id/tasks/:taskId",
    isLoggedIn,
    checkRole(["admin"]),
    async (req, res) => {
      const { taskId } = req.params;

      try {
        await pool.query("DELETE FROM project_tasks WHERE id = $1", [taskId]);
        res.json({ success: true, message: "Tarefa excluída com sucesso." });
      } catch (err) {
        console.error("Erro ao excluir tarefa:", err);
        res.status(500).json({ error: "Erro ao excluir tarefa." });
      }
    },
  );

  return router;
};
