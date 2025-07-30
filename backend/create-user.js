// backend/create-admin.js
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// O caminho do banco de dados no servidor da Fly.io
const dbPath = '/data/painel.db';
const db = new sqlite3.Database(dbPath);

const adminEmail = 'inacio@valorfiscal.com'; // <-- TROQUE PELO SEU EMAIL
const adminPassword = '123@aaa'; // <-- TROQUE PELA SUA SENHA
const adminName = 'Administrador';
const adminRole = 'admin';

// Criptografa a senha
bcrypt.hash(adminPassword, 10, (err, hash) => {
  if (err) {
    return console.error('Erro ao criptografar a senha:', err);
  }

  // Insere o usuário no banco de dados
  const sql = `INSERT INTO users (nome, email, password, role) VALUES (?, ?, ?, ?)`;
  db.run(sql, [adminName, adminEmail, hash, adminRole], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return console.log('O usuário admin já existe.');
      }
      return console.error('Erro ao inserir usuário:', err.message);
    }
    console.log(`Usuário admin "${adminName}" criado com sucesso!`);
  });

  db.close();
});