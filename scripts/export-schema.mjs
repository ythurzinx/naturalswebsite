import { mkdir, readFile, writeFile } from "node:fs/promises";
import { schema } from "../lib/server/schema.mjs";

const target = new URL("../database/mundo-natural-schema.sql", import.meta.url);
const content = [
  "-- Mundo Natural: estrutura do banco para importar no phpMyAdmin.",
  "-- Selecione o mesmo banco usado na DATABASE_URL da aplicacao.",
  "-- Cria apenas tabelas ausentes; preserva os registros existentes.",
  "-- Gerado de lib/server/schema.mjs por npm run db:export.",
  "",
  ...schema.map((statement) => `${statement};\n`),
].join("\n");

if (process.argv.includes("--check")) {
  const existing = await readFile(target, "utf8").catch(() => "");
  if (existing !== content) {
    console.error(
      "O SQL para phpMyAdmin precisa ser atualizado: execute npm run db:export.",
    );
    process.exitCode = 1;
  } else
    console.log(`SQL para phpMyAdmin atualizado: ${schema.length} tabelas.`);
} else {
  await mkdir(new URL("../database/", import.meta.url), { recursive: true });
  await writeFile(target, content, "utf8");
  console.log(
    `database/mundo-natural-schema.sql gerado com ${schema.length} tabelas.`,
  );
}
