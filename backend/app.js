const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs'); // <--- necessário para comparar senhas

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Inicializa o banco
const db = new sqlite3.Database('./painel.db');

// Cria as tabelas se não existirem
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT,
      nome TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      originalname TEXT,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// LOGIN COM VALIDAÇÃO DE SENHA E RETORNO DO NOME
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).send({ error: 'Erro no servidor' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Usuário não encontrado' });
    }

    const senhaOk = await bcrypt.compare(password, user.password);
    if (!senhaOk) {
      return res.status(401).json({ message: 'Senha incorreta' });
    }

    res.json({
      email: user.email,
      nome: user.nome || '',
      role: user.role
    });
  });
});

// CADASTRAR COMUNICADOS
app.post('/api/admin/notice', (req, res) => {
  const { message } = req.body;
  db.run('INSERT INTO notices (message) VALUES (?)', [message], function (err) {
    if (err) return res.status(500).send({ error: 'Erro ao salvar comunicado' });
    res.send({ success: true });
  });
});

// LISTAR COMUNICADOS
app.get('/api/notices', (req, res) => {
  db.all('SELECT * FROM notices ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).send({ error: 'Erro ao buscar comunicados' });
    res.send(rows);
  });
});

// ENDPOINT DE REDEFINIÇÃO (não implementado)
app.post('/redefinir-senha', async (req, res) => {
  const { email } = req.body;
  return res.json({ message: 'Email enviado com instruções.' });
});

// CONFIGURAÇÃO DE UPLOAD COM MULTER
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ENVIO DE ARQUIVOS
app.post('/api/admin/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send({ error: 'Arquivo ausente' });
  db.run('INSERT INTO files (filename, originalname) VALUES (?, ?)', [file.filename, file.originalname], function (err) {
    if (err) return res.status(500).send({ error: 'Erro ao salvar metadados' });
    res.send({ success: true, file: file.filename });
  });
});

// LISTA DE ARQUIVOS
app.get('/api/files', (req, res) => {
  db.all('SELECT * FROM files ORDER BY uploaded_at DESC', (err, rows) => {
    if (err) return res.status(500).send({ error: 'Erro ao buscar arquivos' });
    res.send(rows);
  });
});

// ADMINISTRAÇÃO DE USUÁRIOS
app.get('/api/admin/users', (req, res) => {
  db.all('SELECT id, nome, email, role FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar usuários' });
    res.json(rows);
  });
});

// CRIAÇÃO DE USUÁRIO
app.post('/api/admin/users', (req, res) => {
  const { nome, email, password, role } = req.body;
  const bcrypt = require('bcryptjs');

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Erro ao criptografar senha' });

    db.run(
      'INSERT INTO users (nome, email, password, role) VALUES (?, ?, ?, ?)',
      [nome, email, hash, role],
      function (err) {
        if (err) return res.status(500).json({ error: 'Erro ao criar usuário' });
        res.json({ success: true, id: this.lastID });
      }
    );
  });
});

// EDIÇÃO DE USUÁRIO
app.put('/api/admin/users/:id', (req, res) => {
  const { nome, role } = req.body;
  const { id } = req.params;

  db.run(
    'UPDATE users SET nome = ?, role = ? WHERE id = ?',
    [nome, role, id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar usuário' });
      res.json({ success: true });
    }
  );
});

// DELETAR USUÁRIO
app.delete('/api/admin/users/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao deletar usuário' });
    res.json({ success: true });
  });
});

// INICIA SERVIDOR
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
