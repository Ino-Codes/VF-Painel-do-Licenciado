const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// --- DADOS DO USUÁRIO A SER CRIADO ---
const adminEmail = 'inacio@valorfiscal.com'; // <-- TROQUE PELO SEU EMAIL
const adminPassword = '123@aaa'; // <-- TROQUE PELA SUA SENHA
const adminName = 'Administrador';
const adminRole = 'admin';
// -------------------------------------

// Pega a URL de conexão da variável de ambiente, igual ao app.js
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Erro: A variável de ambiente DATABASE_URL não está definida.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const createUser = async () => {
  try {
    // Criptografa a senha
    const hash = await bcrypt.hash(adminPassword, 10);
    console.log('Senha criptografada com sucesso.');

    // Prepara o comando SQL para inserir o usuário
    const sql = 'INSERT INTO users (nome, email, password, role) VALUES ($1, $2, $3, $4)';
    
    // Executa o comando
    await pool.query(sql, [adminName, adminEmail, hash, adminRole]);
    
    console.log(`>>> Usuário admin "${adminName}" criado com sucesso! <<<`);

  } catch (err) {
    if (err.code === '23505') { // Código de erro do PostgreSQL para violação de unicidade
      console.log('O usuário com este email já existe no banco de dados.');
    } else {
      console.error('Erro ao criar usuário:', err);
    }
  } finally {
    // Fecha a conexão com o banco de dados
    await pool.end();
    console.log('Conexão com o banco de dados fechada.');
  }
};

createUser();