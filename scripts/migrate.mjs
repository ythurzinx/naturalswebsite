import { existsSync } from "node:fs";
import { createDatabase } from "../lib/server/database.mjs";
import { migrate } from "../lib/server/schema.mjs";
for (const file of [".env.local", ".env"])
  if (existsSync(file)) process.loadEnvFile(file);
let pool;
try {
  pool = createDatabase(process.env);
  if (!pool) throw Error();
  await migrate(pool);
  console.log(
    "Tabelas da loja criadas/verificadas com sucesso. Nenhum dado existente foi apagado.",
  );
} catch {
  console.error(
    "Não foi possível preparar o banco. Confira DATABASE_URL, acesso e permissões MySQL.",
  );
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
