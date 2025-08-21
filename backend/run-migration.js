// Importa o dotenv para carregar as variáveis do arquivo .env
require("dotenv").config();

const { Pool } = require("pg");

// Configura a conexão com o banco de dados usando a variável de ambiente
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Define o comando SQL que queremos executar
const migrationQuery = `
  ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS certificate_template_url TEXT;
`;

// Função assíncrona para rodar a migração
const runMigration = async () => {
  console.log(
    "Iniciando migração: Adicionando coluna de modelo de certificado..."
  );
  const client = await pool.connect();
  try {
    // Executa o comando SQL
    await client.query(migrationQuery);

    console.log(
      'Migração concluída com sucesso! A coluna "certificate_template_url" foi adicionada à tabela "courses".'
    );
  } catch (err) {
    console.error("Erro durante a migração!", err);
  } finally {
    // Libera a conexão com o banco
    client.release();
    // Encerra o pool de conexões para que o script termine
    await pool.end();
  }
};

// Executa a função
runMigration();
