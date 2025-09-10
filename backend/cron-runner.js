// backend/cron-runner.js

// Este arquivo tem um único objetivo: chamar a função que envia os emails.
// Ele será executado pela Render na hora agendada.

const { sendEventNotifications } = require("./cron.js");

console.log("CRON RUNNER: Iniciando execução manual da tarefa de notificação.");

sendEventNotifications()
  .then(() => {
    console.log("CRON RUNNER: Tarefa concluída com sucesso.");
    // Em ambientes de produção, o processo deve terminar para a Render saber que acabou.
    process.exit(0);
  })
  .catch((error) => {
    console.error("CRON RUNNER: A tarefa falhou.", error);
    process.exit(1); // Termina com um código de erro
  });
