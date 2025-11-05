const express = require("express");
const router = express.Router();
const { isLoggedIn, isAdmin, checkRole } = require("../middleware/auth.js");

module.exports = function (pool) {
  // 📦 GET - listar todas as etapas
  router.get("/", isLoggedIn, async (req, res) => {
    try {
      const [stages] = await db.query(
        "SELECT * FROM recruitment_stages ORDER BY stage_order ASC"
      );
      res.json(stages);
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar etapas." });
    }
  });

  // ➕ POST - criar nova etapa
  router.post("/", isLoggedIn, async (req, res) => {
    const { name } = req.body;

    if (!name)
      return res.status(400).json({ error: "Nome da etapa é obrigatório." });

    try {
      const [maxOrder] = await db.query(
        "SELECT COALESCE(MAX(stage_order), 0) AS max_order FROM recruitment_stages"
      );
      const newOrder = maxOrder[0].max_order + 1;

      const [result] = await db.query(
        "INSERT INTO recruitment_stages (name, stage_order) VALUES (?, ?)",
        [name, newOrder]
      );

      res.status(201).json({
        id: result.insertId,
        name,
        stage_order: newOrder,
      });
    } catch (err) {
      res.status(500).json({ error: "Erro ao criar etapa." });
    }
  });

  // ✏️ PUT - atualizar nome da etapa
  router.put("/:id", isLoggedIn, async (req, res) => {
    const { name } = req.body;
    const { id } = req.params;

    if (!name)
      return res.status(400).json({ error: "Nome da etapa é obrigatório." });

    try {
      await db.query("UPDATE recruitment_stages SET name = ? WHERE id = ?", [
        name,
        id,
      ]);
      res.json({ message: "Etapa atualizada com sucesso." });
    } catch (err) {
      res.status(500).json({ error: "Erro ao atualizar etapa." });
    }
  });

  // 🔄 PUT - atualizar ordem das etapas
  router.put("/reorder", isLoggedIn, async (req, res) => {
    const { order } = req.body;
    // order = [{ id: 1, stage_order: 1 }, { id: 2, stage_order: 2 }]

    try {
      const promises = order.map((s) =>
        db.query("UPDATE recruitment_stages SET stage_order = ? WHERE id = ?", [
          s.stage_order,
          s.id,
        ])
      );
      await Promise.all(promises);
      res.json({ message: "Ordem atualizada com sucesso." });
    } catch (err) {
      res.status(500).json({ error: "Erro ao atualizar ordem das etapas." });
    }
  });

  // ❌ DELETE - excluir etapa
  router.delete("/:id", isLoggedIn, async (req, res) => {
    const { id } = req.params;

    try {
      await db.query("DELETE FROM recruitment_stages WHERE id = ?", [id]);
      res.json({ message: "Etapa excluída com sucesso." });
    } catch (err) {
      res.status(500).json({ error: "Erro ao excluir etapa." });
    }
  });

  return router;
};
