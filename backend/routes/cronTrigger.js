// backend/routes/cronTrigger.js
const express = require("express");
const router = express.Router();
const { sendEventNotifications } = require("../cron.js");

module.exports = function (pool) {
  router.post("/trigger-notifications", async (req, res) => {
    const authHeader = req.headers["authorization"];
    const sentKey = authHeader && authHeader.split(" ")[1];

    if (sentKey !== process.env.CRON_SECRET_KEY) {
      console.log("CRON TRIGGER: Tentativa de acionamento com chave inválida.");
      return res.status(401).send("Acesso não autorizado.");
    }

    console.log(
      "CRON TRIGGER: Gatilho recebido. Iniciando envio de notificações..."
    );

    // Responde imediatamente para o GitHub Actions não ficar preso esperando
    res
      .status(202)
      .send("Tarefa de notificação recebida e está sendo processada.");

    // Executa a tarefa em segundo plano
    try {
      await sendEventNotifications();
    } catch (error) {
      console.error("CRON TRIGGER: A tarefa de envio de emails falhou.", error);
    }
  });

  return router;
};
