// backend/migrationRunner.js
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const migrationRunner = async (pool) => {
  // 1. Garante que a tabela de controle existe
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 2. Lê os arquivos da pasta /migrations em ordem alfabética
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // garante ordem 0001, 0002, 0003...

  // 3. Busca as migrations já executadas
  const { rows: executed } = await pool.query(
    "SELECT filename FROM _migrations",
  );
  const executedSet = new Set(executed.map((r) => r.filename));

  // 4. Executa apenas os arquivos ainda não registrados
  for (const file of files) {
    if (executedSet.has(file)) {
      continue; // já foi executado, pula
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, "utf8");

    try {
      await pool.query("BEGIN");
      await pool.query(sql);
      await pool.query("INSERT INTO _migrations (filename) VALUES ($1)", [
        file,
      ]);
      await pool.query("COMMIT");
      console.log(`[migrations] ✔ Executado: ${file}`);
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error(`[migrations] ✖ Erro em ${file}:`, err.message);
      throw err; // para o servidor se uma migration crítica falhar
    }
  }

  console.log("[migrations] Todas as migrations estão em dia.");
};

module.exports = migrationRunner;
