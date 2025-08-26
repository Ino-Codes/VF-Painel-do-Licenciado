// run-video-migration.js
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const migrationQuery = `
  ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS category TEXT;
`;

const runMigration = async () => {
  console.log(
    "Iniciando migração: Adicionando coluna 'category' à tabela 'videos'..."
  );
  const client = await pool.connect();
  try {
    await client.query(migrationQuery);
    console.log("Migração concluída com sucesso!");
  } catch (err) {
    console.error("Erro durante a migração!", err);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigration();
