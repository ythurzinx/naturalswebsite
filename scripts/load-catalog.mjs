// node scripts/load-catalog.mjs /private/catalog-directory
import { readFile, readdir, mkdir } from "node:fs/promises"
import { join, dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"

const folder = process.argv[2]
if (!folder || !process.env.STORE_DB) throw Error("Informe a pasta do catálogo e configure STORE_DB.")
const filenames = (await readdir(folder)).filter(x => /^catalog-\d{2}\.json$/.test(x)).sort()
if (!filenames.length) throw Error("A pasta não contém um catálogo.")
await mkdir(dirname(process.env.STORE_DB), {recursive: true})
const db = new DatabaseSync(process.env.STORE_DB)
db.exec("PRAGMA busy_timeout=5000")
try {
  db.exec("BEGIN IMMEDIATE")
  db.exec("CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY,name TEXT,category TEXT,weight TEXT,price INTEGER,stock REAL,active INTEGER)")
  const insert = db.prepare("INSERT INTO products(id,name,category,weight,price,stock,active) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, weight=excluded.weight, price=excluded.price, stock=excluded.stock, active=excluded.active")
  const seen = new Set()
  for (const filename of filenames) {
    const rows = JSON.parse(await readFile(join(folder, filename), "utf8"))
    for (const [id, name, category, weight, price, stock, active] of rows) {
      if (typeof id !== "string" || !id || seen.has(id) || ![name,category,weight].every(v => typeof v === "string") || !Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(stock) || stock < 0 || typeof active !== "boolean") throw Error("Produto inválido ou duplicado.")
      seen.add(id)
      insert.run(id, name, category, weight, price, stock, Number(active))
    }
  }
  db.exec("COMMIT")
  console.log(seen.size + " produtos importados.")
} catch (err) {
  if (db.isTransaction) db.exec("ROLLBACK")
  throw err
} finally { db.close() }
