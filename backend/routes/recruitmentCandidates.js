const express = require("express");
const router = express.Router();
const { isLoggedIn, isAdmin, checkRole } = require("../middleware/auth.js");

module.exports = function (pool) {
  // 📍 Listar todos os candidatos
  router.get("/api/recruitment/candidates", isLoggedIn, async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM recruitment_candidates ORDER BY created_at DESC"
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao carregar candidatos." });
    }
  });

  // 📍 Criar novo candidato
  router.post("/api/recruitment/candidates", isAdmin, async (req, res) => {
    const { name, email, role_applied_for, stage_id } = req.body;
    if (!name || !stage_id) {
      return res.status(400).json({ error: "Nome e etapa são obrigatórios." });
    }

    try {
      await pool.query(
        "INSERT INTO recruitment_candidates (name, email, role_applied_for, stage_id, created_at) VALUES (?, ?, ?, ?, NOW())",
        [name, email || "", role_applied_for || "", stage_id]
      );
      res.json({ message: "Candidato criado com sucesso." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao criar candidato." });
    }
  });

  // 📍 Atualizar candidato
  router.put("/api/recruitment/candidates/:id", isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, email, role_applied_for, stage_id } = req.body;

    try {
      await pool.query(
        "UPDATE recruitment_candidates SET name = ?, email = ?, role_applied_for = ?, stage_id = ? WHERE id = ?",
        [name, email, role_applied_for, stage_id, id]
      );
      res.json({ message: "Candidato atualizado." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao atualizar candidato." });
    }
  });

  // 📍 Excluir candidato
  router.delete(
    "/api/recruitment/candidates/:id",
    isAdmin,
    async (req, res) => {
      const { id } = req.params;
      try {
        await pool.query("DELETE FROM recruitment_candidates WHERE id = ?", [
          id,
        ]);
        res.json({ message: "Candidato excluído." });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao excluir candidato." });
      }
    }
  );

  // 📍 Mover candidato entre etapas
  router.put(
    "/api/recruitment/candidate/:id/move",
    isLoggedIn,
    async (req, res) => {
      const { id } = req.params;
      const { new_stage_id } = req.body;

      if (!new_stage_id) {
        return res.status(400).json({ error: "Nova etapa não informada." });
      }

      try {
        await pool.query(
          "UPDATE recruitment_candidates SET stage_id = ? WHERE id = ?",
          [new_stage_id, id]
        );
        res.json({ message: "Candidato movido de etapa." });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao mover candidato." });
      }
    }
  );

  return router;
};
