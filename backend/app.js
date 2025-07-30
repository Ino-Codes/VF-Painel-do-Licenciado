// backend/app.js - VERSÃO ATUALIZADA PARA POSTGRESQL
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg'); // Importa a biblioteca do PostgreSQL

const app = express();
const port = 3001;

// Configuração da conexão com o PostgreSQL usando a URL do Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Usa a variável de ambiente que vamos configurar no Render
  ssl: {
    rejectUnauthorized: false
  }
});

// Função para criar as tabelas se não existirem
const createTables = async () => {
  const userTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      nome TEXT
    );`;

  const noticeTable = `
    CREATE TABLE IF NOT EXISTS notices (
      id SERIAL PRIMARY KEY,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  const fileTable = `
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      filename TEXT,
      originalname TEXT,
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    );`;

  try {
    await pool.query(userTable);
    await pool.query(noticeTable);
    await pool.query(fileTable);
    console.log('Tabelas verificadas/criadas com sucesso no PostgreSQL.');
  } catch (err) {
    console.error('Erro ao criar tabelas:', err);
  }
};

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// --- ROTAS DA API (ADAPTADAS PARA POSTGRESQL) ---

// LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  console.log('--- Nova Tentativa de Login ---');
  console.log('Email recebido do frontend:', email);

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      console.log('Resultado da verificação: Usuário não encontrado no banco de dados.');
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    console.log('Usuário encontrado no banco. Email:', user.email);
    console.log('Hash da senha salvo no banco:', user.password);

    // Compara a senha enviada com o hash salvo no banco
    const senhaCorreta = await bcrypt.compare(password, user.password);
    
    // Este é o log mais importante!
    console.log('Resultado do bcrypt.compare:', senhaCorreta); 

    if (!senhaCorreta) {
      console.log('Resultado da verificação: A senha está incorreta.');
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    console.log('Resultado da verificação: Login bem-sucedido!');
    // Retorna os dados do usuário se a senha estiver correta
    res.json({ email: user.email, nome: user.nome, role: user.role });

  } catch (err) {
    console.error('ERRO CRÍTICO NA ROTA /api/login:', err);
    res.status(500).send({ error: 'Erro interno no servidor' });
  }
});

// ADMIN: LISTAR USUÁRIOS
app.get('/api/admin/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nome, email, role FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// ADMIN: CRIAR USUÁRIO
app.post('/api/admin/users', async (req, res) => {
    const { nome, email, password, role } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (nome, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id';
        const result = await pool.query(sql, [nome, email, hash, role]);
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// ADMIN: EDITAR USUÁRIO
app.put('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params; // Pega o ID da URL
  const { nome, role } = req.body; // Pega nome e role do corpo da requisição

  // Validação simples para garantir que os dados necessários foram enviados
  if (!nome || !role) {
    return res.status(400).json({ error: 'Nome e role são obrigatórios.' });
  }

  try {
    const sql = 'UPDATE users SET nome = $1, role = $2 WHERE id = $3';
    const result = await pool.query(sql, [nome, role, id]);

    // Verifica se alguma linha foi de fato alterada
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({ success: true, message: 'Usuário atualizado com sucesso.' });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Inicia o servidor e cria as tabelas
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  createTables();
});