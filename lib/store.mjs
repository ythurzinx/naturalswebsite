import { createClient } from "@libsql/client";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { parseCatalogCsv } from "./import-catalog.mjs";
const schema = [
  "CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,name TEXT,category TEXT,weight TEXT,price INTEGER,stock REAL,active INTEGER)",
  "CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY,phone TEXT,ifood TEXT)",
  "INSERT OR IGNORE INTO settings VALUES(1,'','')",
  "CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,token TEXT UNIQUE,items TEXT,total INTEGER,delivery TEXT,status TEXT,created INTEGER)",
  "CREATE TABLE IF NOT EXISTS arts(id TEXT PRIMARY KEY,name TEXT,kind TEXT,label TEXT,color TEXT)",
  "CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,expiry INTEGER)",
  "CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY,n INTEGER,expires INTEGER)",
];
const importRows = `INSERT INTO products SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]'),json_extract(value,'$[4]'),json_extract(value,'$[5]'),json_extract(value,'$[6]') FROM json_each(?) WHERE true ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,weight=excluded.weight,price=excluded.price,stock=excluded.stock,active=excluded.active`;
async function run(db, sql, ...args) {
  return db.execute({ sql, args });
}
async function get(db, sql, ...args) {
  return (await run(db, sql, ...args)).rows[0];
}
async function all(db, sql, ...args) {
  return (await run(db, sql, ...args)).rows;
}
async function initialize() {
  let url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    if (
      process.env.VERCEL ||
      (process.env.NODE_ENV === "production" && !process.env.STORE_DB)
    )
      fail("Configure o banco persistente da loja.", 503);
    const file = resolve(process.env.STORE_DB || ".private/loja.sqlite");
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    url = "file:" + file;
  } else if (!/^(libsql|https):\/\//.test(url) || !process.env.TURSO_AUTH_TOKEN)
    fail("Confira a configuração do banco remoto.", 503);
  const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await db.batch(schema, "write");
  if (!(await get(db, "SELECT id FROM products LIMIT 1"))) {
    const rows = JSON.parse(
      readFileSync(resolve("data/public-catalog.json"), "utf8"),
    );
    await db.batch(
      rows.map((args) => ({
        sql: "INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,0,1)",
        args,
      })),
      "write",
    );
  }
  return db;
}
let connection;
function database() {
  return (connection ??= initialize().catch((e) => {
    connection = undefined;
    throw e;
  }));
}
function fail(message, status = 400) {
  throw Object.assign(Error(message), { status });
}
const digest = (value) => createHash("sha256").update(value).digest("hex");
const cookieName = "mn_session";
const cookie = (value, age) =>
  cookieName +
  "=" +
  value +
  "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" +
  age +
  (process.env.NODE_ENV === "production" ? "; Secure" : "");
function session(req) {
  return digest(
    (req.headers.get("cookie") || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) || "",
  );
}
async function admin(db, req) {
  return !!(await get(
    db,
    "SELECT 1 FROM sessions WHERE hash=? AND expiry>?",
    session(req),
    Date.now(),
  ));
}
function str(value, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail("Confira os campos preenchidos.");
  return value.trim();
}
function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    fail("Confira os valores numéricos.");
  return value;
}
async function transaction(db, fn) {
  const tx = await db.transaction("write");
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } finally {
    tx.close();
  }
}
function cleanQuery(q) {
  return (q || "").slice(0, 100).replace(/[\\%_]/g, "\\$&");
}
function reply(data, headers = {}) {
  return Response.json(data, {
    headers: { "Cache-Control": "private, no-store", ...headers },
  });
}
const upsert =
  "INSERT INTO products VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,weight=excluded.weight,price=excluded.price,stock=excluded.stock,active=excluded.active";
export async function storeRequest(req) {
  try {
    const url = new URL(req.url),
      db = await database(),
      authorized = await admin(db, req),
      settings = await get(db, "SELECT phone,ifood FROM settings");
    if (req.method === "GET") {
      const view = url.searchParams.get("view") || "catalog";
      if (view === "session") return reply({ authorized });
      if (view !== "catalog" && !authorized) fail("Entre no painel.", 401);
      if (view === "arts")
        return reply({
          arts: await all(db, "SELECT * FROM arts ORDER BY name"),
        });
      if (view === "orders")
        return reply({
          orders: (
            await all(
              db,
              "SELECT id,items,total,delivery,status,created FROM orders ORDER BY created DESC LIMIT 500",
            )
          ).map((o) => ({ ...o, items: JSON.parse(o.items) })),
        });
      if (view === "settings") return reply(settings);
      if (!["catalog", "products"].includes(view)) fail("Página inválida.");
      const priv = view === "products",
        q = "%" + cleanQuery(url.searchParams.get("q")) + "%",
        cat = url.searchParams.get("category") || "";
      const where =
        `WHERE (name LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\') AND (?='' OR category=?)` +
        (priv ? "" : " AND active=1 AND price>0");
      const args = [q, q, cat, cat],
        page = Math.max(
          0,
          Math.min(10000, Number(url.searchParams.get("page")) | 0),
        ),
        limit = priv ? 45 : 24;
      const cols = priv
        ? "*"
        : "id,name,category,weight,price,(stock>=1) AS available";
      const products = await all(
        db,
        "SELECT " +
          cols +
          " FROM products " +
          where +
          " ORDER BY (stock>=1) DESC,name,id LIMIT ? OFFSET ?",
        ...args,
        limit,
        page * limit,
      );
      const categories = (
        await all(
          db,
          "SELECT DISTINCT category FROM products " +
            (priv ? "" : "WHERE active=1 AND price>0") +
            " ORDER BY category",
        )
      ).map((x) => x.category);
      return reply({
        products,
        categories,
        count: (
          await get(db, "SELECT count(*) AS n FROM products " + where, ...args)
        ).n,
        phone: settings.phone,
        ifood: settings.ifood,
      });
    }
    if (
      req.method !== "POST" ||
      req.headers.get("origin") !== url.origin ||
      !req.headers.get("content-type")?.startsWith("application/json")
    )
      fail("Origem inválida.", 403);
    const max = authorized ? 6000000 : 16000;
    if (Number(req.headers.get("content-length")) > max)
      fail("Arquivo muito grande.", 413);
    const reader = req.body?.getReader(),
      decoder = new TextDecoder();
    let raw = "",
      size = 0;
    if (!reader) fail("Requisição vazia.");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        fail("Arquivo muito grande.", 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    let b;
    try {
      b = JSON.parse(raw + decoder.decode());
    } catch {
      fail("Dados inválidos.");
    }
    if (!b || typeof b !== "object") fail("Dados inválidos.");
    if (b.action === "login") {
      const secret = process.env.ADMIN_PASSWORD;
      if (!secret || secret.length < 16)
        fail("Configure a senha administrativa no servidor.", 503);
      const now = Date.now(),
        attempt = await get(db, "SELECT * FROM attempts WHERE id=1");
      if (attempt?.expires > now && attempt.n >= 10)
        fail("Tente novamente em 15 minutos.", 429);
      if (
        !timingSafeEqual(
          Buffer.from(digest(String(b.password)), "hex"),
          Buffer.from(digest(secret), "hex"),
        )
      ) {
        await run(
          db,
          "INSERT OR REPLACE INTO attempts VALUES(1,?,?)",
          attempt?.expires > now ? attempt.n + 1 : 1,
          attempt?.expires > now ? attempt.expires : now + 900000,
        );
        fail("Senha inválida.", 401);
      }
      await db.execute("DELETE FROM attempts");
      await run(db, "DELETE FROM sessions WHERE expiry<=?", now);
      const token = randomBytes(32).toString("hex");
      await run(
        db,
        "INSERT INTO sessions VALUES(?,?)",
        digest(token),
        now + 28800000,
      );
      return reply({ ok: true }, { "Set-Cookie": cookie(token, 28800) });
    }
    if (b.action === "order") {
      if (!settings.phone)
        fail("A loja ainda está configurando o WhatsApp.", 503);
      const token = str(b.token, 80);
      if (!/^[0-9a-f-]{36}$/i.test(token)) fail("Identificador inválido.");
      const delivery = str(b.delivery, 30);
      if (!["Entrega local", "Retirada na loja"].includes(delivery))
        fail("Entrega inválida.");
      if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50)
        fail("Confira a sacola.");
      const result = await transaction(db, async (db) => {
        const old = await get(
          db,
          "SELECT id,total,items,delivery FROM orders WHERE token=?",
          token,
        );
        if (old) return { ...old, items: JSON.parse(old.items) };
        if (
          (
            await get(
              db,
              "SELECT count(*) n FROM orders WHERE created>?",
              Date.now() - 60000,
            )
          ).n >= 45
        )
          fail("Muitos pedidos. Tente em um minuto.", 429);
        const ids = new Set(),
          items = [];
        for (const line of b.items) {
          const id = str(line.id, 80),
            qty = integer(line.qty, 1, 999),
            p = await get(
              db,
              "SELECT * FROM products WHERE id=? AND active=1",
              id,
            );
          if (!p || p.stock < qty || ids.has(id) || p.price <= 0)
            fail("Estoque alterado. Revise a sacola.", 409);
          if (line.price !== p.price)
            fail("Um preço mudou. Atualize a sacola antes de continuar.", 409);
          ids.add(id);
          items.push({
            id,
            name: p.name,
            qty,
            price: p.price,
            weight: p.weight,
          });
        }
        const total = items.reduce((sum, p) => sum + p.qty * p.price, 0),
          id = randomBytes(6).toString("hex").toUpperCase();
        await run(
          db,
          "INSERT INTO orders VALUES(?,?,?,?,?,?,?)",
          id,
          token,
          JSON.stringify(items),
          total,
          delivery,
          "A confirmar",
          Date.now(),
        );
        return { id, total, items, delivery };
      });
      return reply({ ...result, phone: settings.phone });
    }
    if (!authorized) fail("Entre no painel.", 401);
    if (b.action === "logout") {
      await run(db, "DELETE FROM sessions WHERE hash=?", session(req));
      return reply({ ok: true }, { "Set-Cookie": cookie("", 0) });
    }
    if (b.action === "product") {
      const id = str(b.id, 80),
        stock = integer(b.stock, 0, 99999999),
        price = integer(b.price, 0, 99999999);
      if (b.create && (await get(db, "SELECT id FROM products WHERE id=?", id)))
        fail("Código já cadastrado.", 409);
      if (b.active && !price) fail("Informe um preço de venda.");
      await run(
        db,
        upsert,
        id,
        str(b.name, 180),
        str(b.category, 80),
        String(b.weight || "").slice(0, 60),
        price,
        stock,
        b.active ? 1 : 0,
      );
    } else if (b.action === "import") {
      let rows;
      try {
        rows = parseCatalogCsv(str(b.csv, 5000000));
      } catch {
        fail(
          "Confira se o CSV é um relatório de preços válido e se os códigos são únicos.",
        );
      }
      await transaction(db, async (tx) => {
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          await tx.execute({ sql: importRows, args: [JSON.stringify(batch)] });
        }
      });
      return reply({ count: rows.length });
    } else if (b.action === "settings") {
      const phone = String(b.phone || "").replace(/[^0-9]/g, "");
      if (!/^55\d{10,11}$/.test(phone))
        fail("Informe o WhatsApp com 55 e DDD.");
      const ifood = String(b.ifood || "").trim();
      if (
        ifood &&
        !/^https:\/\/(www\.)?ifood\.com\.br\/[\w/?=%&.~-]+$/i.test(ifood)
      )
        fail("Informe um link da loja em ifood.com.br.");
      await run(
        db,
        "UPDATE settings SET phone=?,ifood=? WHERE id=1",
        phone,
        ifood,
      );
    } else if (b.action === "status") {
      const next = b.status;
      const transitions = {
        "A confirmar": ["Confirmado", "Cancelado"],
        Confirmado: ["Concluído", "Cancelado"],
      };
      await transaction(db, async (db) => {
        const o = await get(
          db,
          "SELECT * FROM orders WHERE id=?",
          str(b.id, 80),
        );
        if (!o || !transitions[o.status]?.includes(next))
          fail("Etapa indisponível.", 409);
        for (const p of JSON.parse(o.items)) {
          if (
            next === "Confirmado" &&
            !(
              await run(
                db,
                "UPDATE products SET stock=stock-? WHERE id=? AND stock>=? AND active=1",
                p.qty,
                p.id,
                p.qty,
              )
            ).rowsAffected
          )
            fail("Estoque insuficiente para confirmar.", 409);
          if (o.status === "Confirmado" && next === "Cancelado")
            await run(
              db,
              "UPDATE products SET stock=stock+? WHERE id=?",
              p.qty,
              p.id,
            );
        }
        await run(db, "UPDATE orders SET status=? WHERE id=?", next, o.id);
      });
    } else if (b.action === "saveArt") {
      if (
        !["fecho", "lembranca"].includes(b.kind) ||
        !/^#[a-f0-9]{6}$/i.test(b.color)
      )
        fail("Modelo inválido.");
      await run(
        db,
        "INSERT OR REPLACE INTO arts VALUES(?,?,?,?,?)",
        b.id ? str(b.id, 80) : randomBytes(8).toString("hex"),
        str(b.name, 60),
        b.kind,
        str(b.label, 24),
        b.color,
      );
    } else if (b.action === "deleteArt") {
      await run(db, "DELETE FROM arts WHERE id=?", str(b.id, 80));
    } else fail("Alteração desconhecida.");
    return reply({ ok: true });
  } catch (e) {
    return Response.json(
      {
        error: e.status
          ? e.message
          : "Não foi possível concluir. Confira a configuração e o arquivo informado.",
      },
      { status: e.status || 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
