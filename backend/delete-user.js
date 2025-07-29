const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('painel.db');

db.run("DELETE FROM users WHERE email = 'teste'", function (err) {
  if (err) {
    return console.error(err.message);
  }
  console.log(`Usuário excluído com sucesso. Total afetado: ${this.changes}`);
});

db.close();