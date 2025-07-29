const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./painel.db');

const email = 'teste';
const senhaPlano = '123456';
const nome = 'Inácio Teste';
const role = 'admin';

bcrypt.hash(senhaPlano, 10, (err, senhaCriptografada) => {
  if (err) return console.error('Erro ao criptografar:', err);

  db.run(
    `INSERT INTO users (email, password, nome, role) VALUES (?, ?, ?, ?)`,
    [email, senhaCriptografada, nome, role],
    function (err) {
      if (err) return console.error('Erro ao inserir:', err);
      console.log('Usuário criado com sucesso!');
    }
  );
});