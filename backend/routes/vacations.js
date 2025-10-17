const express = require("express");
const router = express.Router();
const { isLoggedIn, checkRole } = require("../middleware/auth.js");

module.exports = function (pool) {
  // Rota para o colaborador buscar seu próprio saldo e histórico
  router.get("/me", isLoggedIn, async (req, res) => {
    const { id: userId } = req.user;
    try {
      const saldoResult = await pool.query(
        "SELECT saldo_ferias FROM users WHERE id = $1",
        [userId]
      );
      const requestsResult = await pool.query(
        "SELECT * FROM vacation_requests WHERE user_id = $1 ORDER BY requested_at DESC",
        [userId]
      );

      res.json({
        saldo_ferias: saldoResult.rows[0]?.saldo_ferias || 0,
        requests: requestsResult.rows,
      });
    } catch (err) {
      console.error("Erro ao buscar dados de férias do utilizador:", err);
      res.status(500).json({ error: "Erro ao buscar dados de férias." });
    }
  });

  // Rota para o colaborador criar um novo pedido de férias
  router.post("/", isLoggedIn, async (req, res) => {
    const { start_date, end_date } = req.body;
    const { id: userId } = req.user;

    try {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);

      // Validação 1: Datas válidas
      if (
        isNaN(startDate.getTime()) ||
        isNaN(endDate.getTime()) ||
        startDate > endDate
      ) {
        return res.status(400).json({ error: "Período de datas inválido." });
      }

      // Validação 2: Início das férias (simplificado, sem feriados por enquanto)
      const startDay = startDate.getDay(); // Domingo = 0, Sábado = 6
      if (startDay === 5 || startDay === 6) {
        // Sexta ou Sábado
        return res.status(400).json({
          error:
            "O início das férias não pode ser nos 2 dias que antecedem o repouso semanal.",
        });
      }

      const diasSolicitados =
        Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      // Validação 3: Saldo de Férias
      const saldoResult = await pool.query(
        "SELECT saldo_ferias FROM users WHERE id = $1",
        [userId]
      );
      const saldoAtual = saldoResult.rows[0]?.saldo_ferias;
      if (saldoAtual < diasSolicitados) {
        return res.status(400).json({ error: "Saldo de férias insuficiente." });
      }

      // Validação 4: Regras de Fracionamento (CLT)
      const outrosPeriodosResult = await pool.query(
        "SELECT dias_solicitados FROM vacation_requests WHERE user_id = $1 AND status = 'Aprovado'",
        [userId]
      );
      const todosPeriodos = [
        ...outrosPeriodosResult.rows.map((r) => r.dias_solicitados),
        diasSolicitados,
      ];
      if (todosPeriodos.length > 3) {
        return res.status(400).json({
          error: "As férias só podem ser divididas em até 3 períodos.",
        });
      }
      if (diasSolicitados < 5) {
        return res.status(400).json({
          error: "Nenhum período de férias pode ser inferior a 5 dias.",
        });
      }
      if (!todosPeriodos.some((dias) => dias >= 14)) {
        return res.status(400).json({
          error:
            "Pelo menos um dos períodos de férias deve ter no mínimo 14 dias.",
        });
      }

      // Se todas as validações passaram, insere o pedido
      await pool.query(
        "INSERT INTO vacation_requests (user_id, start_date, end_date, dias_solicitados) VALUES ($1, $2, $3, $4)",
        [userId, start_date, end_date, diasSolicitados]
      );

      res
        .status(201)
        .json({ message: "Pedido de férias enviado com sucesso!" });
    } catch (err) {
      console.error("Erro ao criar pedido de férias:", err);
      res
        .status(500)
        .json({ error: "Erro interno ao processar a solicitação." });
    }
  });

  // Rota para o RH/Admin buscar TODOS os pedidos para o calendário
  router.get("/", isLoggedIn, checkRole(["admin", "rh"]), async (req, res) => {
    try {
      const query = `
        SELECT vr.*, u.nome as user_name 
        FROM vacation_requests vr 
        JOIN users u ON vr.user_id = u.id
        ORDER BY vr.start_date ASC
      `;
      const result = await pool.query(query);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar pedidos de férias:", err);
      res.status(500).json({ error: "Erro ao buscar pedidos de férias." });
    }
  });

  // Rota para o RH/Admin aprovar ou recusar um pedido
  router.put(
    "/:id/status",
    isLoggedIn,
    checkRole(["admin", "rh"]),
    async (req, res) => {
      const { id } = req.params;
      const { status, observacao } = req.body;
      const approverId = req.user.id;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const requestResult = await client.query(
          `SELECT 
                vr.user_id, 
                vr.dias_solicitados, 
                vr.status as old_status, 
                u.saldo_ferias 
             FROM vacation_requests vr
             JOIN users u ON vr.user_id = u.id
             WHERE vr.id = $1`,
          [id]
        );

        if (requestResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return res
            .status(404)
            .json({ error: "Pedido de férias não encontrado." });
        }

        const { user_id, dias_solicitados, old_status, saldo_ferias } =
          requestResult.rows[0];

        // Se a ação for 'Aprovar', verifica se há saldo suficiente AGORA
        if (status === "Aprovado" && old_status !== "Aprovado") {
          if (saldo_ferias < dias_solicitados) {
            await client.query("ROLLBACK");
            return res.status(400).json({
              error: `Saldo insuficiente para aprovar. Saldo atual: ${saldo_ferias} dias. Solicitado: ${dias_solicitados} dias.`,
            });
          }
          // Se tem saldo, desconta
          await client.query(
            "UPDATE users SET saldo_ferias = saldo_ferias - $1 WHERE id = $2",
            [dias_solicitados, user_id]
          );
        } else if (status !== "Aprovado" && old_status === "Aprovado") {
          // Se estava aprovado e agora não está (ex: Recusado), devolve o saldo
          await client.query(
            "UPDATE users SET saldo_ferias = saldo_ferias + $1 WHERE id = $2",
            [dias_solicitados, user_id]
          );
        }

        await client.query(
          "UPDATE vacation_requests SET status = $1, observacao = $2, approver_id = $3, approved_at = NOW() WHERE id = $4",
          [status, observacao, approverId, id]
        );

        await client.query("COMMIT");
        res.json({ success: true, message: "Status do pedido atualizado." });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao atualizar status do pedido:", err);
        res.status(500).json({ error: "Erro ao atualizar status." });
      } finally {
        client.release();
      }
    }
  );

  return router;
};
