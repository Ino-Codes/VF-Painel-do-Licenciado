const express = require("express");
const router = express.Router();
const rdApi = require("../services/rdstation.js");

module.exports = function (pool) {
  const { isLoggedIn, checkRole } = require("../middleware/auth.js");

  // Rota para o Licenciado criar uma nova oportunidade
  router.post("/", isLoggedIn, async (req, res) => {
    const {
      client_name,
      client_cnpj,
      client_contact_name,
      client_contact_phone,
    } = req.body;
    const licenciadoId = req.user.id;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 2. Busca o ID do gestor e o ID DO RD STATION do gestor
      const gestorResult = await client.query(
        `SELECT u.id AS gestor_id, u.rdstation_user_id 
         FROM users u 
         WHERE u.id = (SELECT gestor_id FROM users WHERE id = $1)`,
        [licenciadoId]
      );

      const gestor = gestorResult.rows[0];
      const colaboradorId = gestor?.gestor_id;
      const rdstationUserId = gestor?.rdstation_user_id;

      // 3. Validação CRÍTICA: Garante que o vendedor tem um ID do RD configurado
      if (!rdstationUserId) {
        throw new Error(
          "O gestor responsável por este licenciado não possui um ID do RD Station configurado no painel."
        );
      }

      // 4. (Opcional, mas recomendado) Salva a oportunidade no nosso banco de dados primeiro
      const localOppResult = await client.query(
        "INSERT INTO opportunities (client_name, client_cnpj, client_contact_name, client_contact_phone, licenciado_id, colaborador_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          client_name,
          client_cnpj.replace(/\D/g, ""),
          client_contact_name,
          client_contact_phone.replace(/\D/g, ""),
          licenciadoId,
          colaboradorId,
        ]
      );

      // 5. Envia os dados para criar a "Negociação" (Deal) no RD Station
      const dealPayload = {
        deal: {
          name: `Oportunidade - ${client_name}`,
          user_id: rdstationUserId, // <-- A MÁGICA ACONTECE AQUI!
          // IMPORTANTE: Você precisará de um ID do funil e do estágio inicial.
          // Estes IDs são encontrados na sua conta do RD Station.
          deal_stage_id: "SEU_ID_DO_ESTAGIO_INICIAL_AQUI",
        },
        // O RD Station também pode precisar de dados de contato
        contacts: [
          {
            name: client_contact_name || client_name,
            phones: [{ phone: client_contact_phone.replace(/\D/g, "") }],
          },
        ],
      };

      await rdApi.post("/deals", dealPayload);

      await client.query("COMMIT");
      res.status(201).json(localOppResult.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "23505") {
        return res.status(409).json({ error: "Este CNPJ já foi cadastrado." });
      }
      console.error("Erro ao cadastrar oportunidade:", err.message);
      // Retorna uma mensagem de erro mais específica para o frontend
      res
        .status(500)
        .json({ error: err.message || "Erro ao cadastrar oportunidade." });
    } finally {
      client.release();
    }
  });

  // Rota para listar oportunidades (consulta por API no RD Station)
  router.get("/kanban", isLoggedIn, async (req, res) => {
    try {
      const gestorResult = await pool.query(
        "SELECT rdstation_user_id FROM users WHERE id = (SELECT gestor_id FROM users WHERE id = $1)",
        [req.user.id]
      );
      const rdstationUserId = gestorResult.rows[0]?.rdstation_user_id;

      // Faz uma chamada à API do RD para buscar as negociações (deals) deste utilizador
      const response = await rdApi.get(`/deals?user_id=${rdstationUserId}`);

      // Você também precisará de uma rota para buscar os "estágios" do seu funil
      const stagesResponse = await rdApi.get(
        "/deal_pipelines/SEU_PIPELINE_ID/deal_stages"
      );

      res.json({
        deals: response.data.deals,
        stages: stagesResponse.data.deal_stages,
      });
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar dados do Kanban." });
    }
  });

  // Rota para o Colaborador/Admin atualizar o status
  router.put(
    "/:id/status",
    isLoggedIn,
    checkRole(["admin", "comercial"]),
    async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      const { id: userId, role } = req.user;

      if (role === "licenciado") {
        return res.status(403).json({
          error: "Apenas colaboradores ou admins podem alterar o status.",
        });
      }

      try {
        const result = await pool.query(
          "UPDATE opportunities SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
          [status, id]
        );
        res.json(result.rows[0]);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao atualizar status." });
      }
    }
  );

  return router;
};
