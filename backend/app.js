const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const app = express();
const port = 3001;

// Configuração da conexão com o PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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

// LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT id, nome, email, role, password, avatar_url FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }
    const senhaOk = await bcrypt.compare(password, user.password);
    if (!senhaOk) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    delete user.password; 

    res.json(user);

  } catch (err) {
    console.error('Erro na rota /api/login:', err);
    res.status(500).send({ error: 'Erro no servidor' });
  }
});

// ADMIN: LISTAR USUÁRIOS
app.get('/api/admin/users', async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;

  try {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE nome ILIKE $1 OR email ILIKE $1`;
    }

    const countSql = `SELECT COUNT(*) FROM users ${whereClause}`;
    const usersSql = `SELECT id, nome, email, role FROM users ${whereClause} ORDER BY nome ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const countParams = [...params];
    const usersParams = [...params, limit, offset];

    const [countResult, usersResult] = await Promise.all([
      pool.query(countSql, countParams),
      pool.query(usersSql, usersParams)
    ]);

    const totalCount = parseInt(countResult.rows[0].count, 10);
    const users = usersResult.rows;

    res.json({
      users,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    });

  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
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
  const { id } = req.params;
  const { nome, role } = req.body;

  if (!nome || !role) {
    return res.status(400).json({ error: 'Nome e role são obrigatórios.' });
  }

  try {
    const sql = 'UPDATE users SET nome = $1, role = $2 WHERE id = $3';
    const result = await pool.query(sql, [nome, role, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({ success: true, message: 'Usuário atualizado com sucesso.' });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// ADMIN: EXCLUIR USUÁRIO
app.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const sql = 'DELETE FROM users WHERE id = $1';
    const result = await pool.query(sql, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado para exclusão.' });
    }

    res.json({ success: true, message: 'Usuário excluído com sucesso.' });
  } catch (err) {
    console.error('Erro ao excluir usuário:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// PERFIL: UPLOAD DE FOTO DE PERFIL
app.post('/api/users/:id/avatar', upload.single('avatar'), async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  try {
    const userResult = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [id]);
    const oldAvatarUrl = userResult.rows[0]?.avatar_url;

    if (oldAvatarUrl) {
      const publicId = oldAvatarUrl.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(publicId);
      console.log('Avatar antigo excluído do Cloudinary.');
    }

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
        if (error) reject(error);
        resolve(result);
      }).end(req.file.buffer);
    });

    const newAvatarUrl = uploadResult.secure_url;

    const updateSql = 'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING avatar_url';
    const updateResult = await pool.query(updateSql, [newAvatarUrl, id]);

    console.log('Avatar atualizado com sucesso no banco de dados.');
    res.json({ success: true, avatarUrl: updateResult.rows[0].avatar_url });

  } catch (err) {
    console.error('Erro no processo de upload de avatar:', err);
    res.status(500).json({ error: 'Erro no servidor durante o upload.' });
  }
});

// PERFIL: ALTERAÇÃO DO NOME DO USUÁRIO
app.put('/api/users/:id/profile', async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'O campo nome é obrigatório.' });
  }

  try {
    const sql = 'UPDATE users SET nome = $1 WHERE id = $2 RETURNING id, nome, email, role, avatar_url';
    const result = await pool.query(sql, [nome, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// PERFIL: ALTERAÇÃO DE SENHA
app.put('/api/users/:id/change-password', async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  try {
    const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [id]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const storedHash = userResult.rows[0].password;

    const isMatch = await bcrypt.compare(currentPassword, storedHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'A senha atual está incorreta.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newHash, id]);

    res.json({ success: true, message: 'Senha alterada com sucesso.' });

  } catch (err) {
    console.error('Erro ao alterar senha:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// PERFIL: REMOVER FOTO DE PERFIL
app.delete('/api/users/:id/avatar', async (req, res) => {
  const { id } = req.params;

  try {
    const userResult = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [id]);
    const oldAvatarUrl = userResult.rows[0]?.avatar_url;

    if (oldAvatarUrl) {
      const publicId = oldAvatarUrl.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    }

    const updateResult = await pool.query(
      'UPDATE users SET avatar_url = NULL WHERE id = $1 RETURNING id, nome, email, role, avatar_url',
      [id]
    );

    res.json({ success: true, user: updateResult.rows[0] });

  } catch (err) {
    console.error('Erro ao remover avatar:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// DOCUMENTOS: LISTAR ARQUIVOS
app.get('/api/files', async (req, res) => {
  const { category, search, page = 1, limit = 10 } = req.query;

  try {
    const offset = (page - 1) * limit;
    let whereClauses = [];
    const params = [];

    if (category) {
      params.push(category);
      whereClauses.push(`category = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`originalname ILIKE $${params.length}`);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) FROM files ${whereString}`;
    const filesSql = `SELECT id, originalname, filename, category, uploaded_at FROM files ${whereString} ORDER BY uploaded_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    
    const countParams = [...params];
    const filesParams = [...params, limit, offset];

    const [countResult, filesResult] = await Promise.all([
      pool.query(countSql, countParams),
      pool.query(filesSql, filesParams)
    ]);

    const totalCount = parseInt(countResult.rows[0].count, 10);
    const files = filesResult.rows;

    res.json({
      files,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    });

  } catch (err) {
    console.error('Erro ao buscar arquivos:', err);
    res.status(500).json({ error: 'Erro ao buscar arquivos' });
  }
});

// DOCUMENTOS: UPLOAD DE NOVO ARQUIVO
app.post('/api/files', upload.single('file'), async (req, res) => {
  const { originalname, category } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  try {
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ resource_type: 'auto' }, (error, result) => {
        if (error) reject(error);
        resolve(result);
      }).end(req.file.buffer);
    });

    const fileUrl = uploadResult.secure_url;

    const sql = 'INSERT INTO files (filename, originalname, category) VALUES ($1, $2, $3) RETURNING *';
    const result = await pool.query(sql, [fileUrl, originalname, category]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro no upload de arquivo:', err);
    res.status(500).json({ error: 'Erro no servidor durante o upload.' });
  }
});

// DOCUMENTOS: DELETAR UM ARQUIVO
app.delete('/api/files/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const fileResult = await pool.query('SELECT filename FROM files WHERE id = $1', [id]);
    if (fileResult.rowCount === 0) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }
    const fileUrl = fileResult.rows[0].filename;

    const publicId = fileUrl.split('/').pop().split('.')[0];
    await cloudinary.uploader.destroy(publicId);

    await pool.query('DELETE FROM files WHERE id = $1', [id]);

    res.json({ success: true, message: 'Arquivo excluído com sucesso.' });
  } catch (err) {
    console.error('Erro ao excluir arquivo:', err);
    res.status(500).json({ error: 'Erro ao excluir arquivo.' });
  }
});

app.put('/api/files/:id', async (req, res) => {
    const { id } = req.params;
    const { originalname, category } = req.body;
    try {
        const sql = 'UPDATE files SET originalname = $1, category = $2 WHERE id = $3 RETURNING *';
        const result = await pool.query(sql, [originalname, category, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Arquivo não encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao editar arquivo:', err);
        res.status(500).json({ error: 'Erro ao editar arquivo.' });
    }
});

// Inicia o servidor e cria as tabelas
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  createTables();
});