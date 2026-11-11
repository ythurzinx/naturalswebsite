import { excludedProduct } from "./catalog-names.mjs";
import { estimateFreight } from "./freight.mjs";
import { comboSchema, listCombos, saveCombo, stockLines } from "./combos.mjs";
import { createClient } from "@libsql/client";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { parseCatalogCsv } from "./import-catalog.mjs";
const schema = [
  "CREATE TABLE IF NOT EXISTS brand(id INTEGER PRIMARY KEY,logo TEXT,rate INTEGER)",
  "INSERT OR IGNORE INTO brand VALUES(1,'',150)",
  "CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY,photo TEXT)",
  "CREATE TABLE IF NOT EXISTS checkoutDetails(id TEXT PRIMARY KEY,customer TEXT,shipping INTEGER)",
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
  await db.batch([...schema, ...comboSchema], "write");
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
  await run(
    db,
    "CREATE TABLE IF NOT EXISTS storeMigrations(id TEXT PRIMARY KEY)",
  );
  if (
    !(await get(db, "SELECT id FROM storeMigrations WHERE id='catalog-clean'"))
  ) {
    const legacy = await all(db, "SELECT id,name FROM products WHERE active=1");
    const changes = legacy
      .filter((p) => excludedProduct(p.name))
      .map((p) => ({
        sql: "UPDATE products SET active=0 WHERE id=?",
        args: [p.id],
      }));
    await db.batch(
      [
        ...changes,
        "INSERT OR IGNORE INTO storeMigrations VALUES('catalog-clean')",
      ],
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
export async function shopConfig() {
  return get(await database(), "SELECT logo,rate FROM brand WHERE id=1");
}
function photoData(value) {
  if (!value) return "";
  if (
    typeof value !== "string" ||
    value.length > 550000 ||
    !/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(value)
  )
    fail("Selecione uma imagem WebP menor.");
  const bytes = Buffer.from(value.split(",")[1], "base64");
  if (
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  )
    fail("Imagem inválida.");
  return value;
}
function buyer(data, delivery) {
  const name = str(data?.name, 100),
    email = str(data?.email, 190),
    phone = str(data?.phone, 24).replace(/\D/g, "");
  if (
    name.split(/\s+/).length < 2 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    !/^\d{10,13}$/.test(phone)
  )
    fail("Confira nome completo, e-mail e telefone.");
  return {
    name,
    email,
    phone,
    address: delivery === "Entrega local" ? str(data?.address, 300) : "",
    cep: delivery === "Entrega local" ? str(data?.cep, 9) : "",
  };
}
const upsert =
  "INSERT INTO products VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,weight=excluded.weight,price=excluded.price,stock=excluded.stock,active=excluded.active";
export async function storeRequest(req) {
  try {
    const url = new URL(req.url),
      db = await database(),
      authorized = await admin(db, req),
      settings = await get(
        db,
        "SELECT COALESCE(NULLIF(phone,''),'551151993525') AS phone,ifood FROM settings",
      );
    if (req.method === "GET") {
      const view = url.searchParams.get("view") || "catalog";
      if (view === "brand") return reply(await shopConfig());
      if (view === "session") return reply({ authorized });
      if (view === "combos") return reply({ combos: await listCombos(db) });
      if (view !== "catalog" && !authorized) fail("Entre no painel.", 401);
      if (view === "adminCombos")
        return reply({ combos: await listCombos(db, true) });
      if (view === "arts")
        return reply({
          arts: await all(db, "SELECT * FROM arts ORDER BY name"),
        });
      if (view === "orders")
        return reply({
          orders: (
            await all(
              db,
              "SELECT orders.id,items,total,delivery,status,created,customer,COALESCE(shipping,0) as shipping FROM orders LEFT JOIN checkoutDetails ON checkoutDetails.id=orders.id ORDER BY created DESC LIMIT 500",
            )
          ).map((o) => ({
            ...o,
            customer: o.customer ? JSON.parse(o.customer) : null,
            items: JSON.parse(o.items),
          })),
        });
      if (view === "settings")
        return reply({ ...settings, ...(await shopConfig()) });
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
          ",COALESCE((SELECT photo FROM photos WHERE photos.id=products.id),'') AS photo FROM products " +
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
        products: products.map((p) => ({
          ...p,
          bulk: Number(p.weight === "a granel (kg)"),
        })),
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
      const customer = buyer(b.customer, delivery);
      const existing = await get(
        db,
        "SELECT orders.id,items,total,delivery,shipping FROM orders LEFT JOIN checkoutDetails ON checkoutDetails.id=orders.id WHERE token=?",
        token,
      );
      if (existing)
        return reply({
          ...existing,
          items: JSON.parse(existing.items),
          phone: settings.phone,
        });
      const shipping =
        delivery === "Entrega local"
          ? (await estimateFreight(customer.cep, (await shopConfig()).rate))
              .cents
          : 0;
      if (b.shipping !== shipping)
        fail("O frete mudou. Calcule novamente.", 409);
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
            qty = integer(line.qty, 1, 999);
          if (id.startsWith("kit:")) {
            const [combo] = await listCombos(db, false, id.split(":")[1]);
            if (
              !combo ||
              combo.id !== id ||
              !combo.available ||
              combo.price !== line.price ||
              ids.has(id)
            )
              fail(
                "O combo mudou. Remova-o da sacola e escolha novamente.",
                409,
              );
            ids.add(id);
            items.push({
              id,
              name: combo.name,
              qty,
              price: combo.price,
              weight: combo.members
                .map((p) => p.qty + " × " + p.name)
                .join(" + "),
              members: combo.members,
            });
            continue;
          }
          const portion = /^g:(\d+):(.+)$/.exec(id);
          const grams = portion ? integer(Number(portion[1]), 1, 50000) : 0;
          const p = await get(
            db,
            "SELECT * FROM products WHERE id=? AND active=1",
            portion ? portion[2] : id,
          );
          if (!p || p.stock < qty || ids.has(id) || p.price <= 0)
            fail("Estoque alterado. Revise a sacola.", 409);
          if (Boolean(portion) !== (p.weight === "a granel (kg)"))
            fail("Escolha a apresentação atual do produto.", 409);
          const price = portion
            ? Math.round((p.price * grams) / 1000)
            : p.price;
          if (price < 1 || line.price !== price)
            fail("Um preço mudou. Atualize a sacola antes de continuar.", 409);
          ids.add(id);
          items.push({
            id,
            name: p.name,
            qty,
            price,
            weight: portion ? grams + " g" : p.weight,
            ...(portion ? { members: [{ id: p.id, qty: grams }] } : {}),
          });
        }
        for (const part of stockLines(items)) {
          if (
            !(await get(
              db,
              "SELECT 1 FROM products WHERE id=? AND active=1 AND stock>=?",
              part.id,
              part.qty,
            ))
          )
            fail(
              "Estoque insuficiente para a combinação de itens da sacola.",
              409,
            );
        }
        const total = items.reduce((sum, p) => sum + p.qty * p.price, shipping),
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
        await run(
          db,
          "INSERT INTO checkoutDetails VALUES(?,?,?)",
          id,
          JSON.stringify(customer),
          shipping,
        );
        return { id, total, items, delivery, shipping };
      });
      return reply({ ...result, phone: settings.phone });
    }
    if (!authorized) fail("Entre no painel.", 401);
    if (b.action === "logout") {
      await run(db, "DELETE FROM sessions WHERE hash=?", session(req));
      return reply({ ok: true }, { "Set-Cookie": cookie("", 0) });
    }
    if (b.action === "saveCombo") {
      await transaction(db, (tx) => saveCombo(tx, b));
      return reply({ ok: true });
    }
    if (b.action === "product") {
      const id = str(b.id, 80),
        stock = integer(b.stock, 0, 99999999),
        price = integer(b.price, 0, 99999999);
      if (id.startsWith("kit:") || id.startsWith("g:"))
        fail("Prefixo reservado para combos.");
      if (b.create && (await get(db, "SELECT id FROM products WHERE id=?", id)))
        fail("Código já cadastrado.", 409);
      if (excludedProduct(str(b.name, 180)))
        fail("Categoria excluída do catálogo.");
      if (b.active && !price) fail("Informe um preço de venda.");
      const photo = photoData(b.photo);
      await transaction(db, async (db) => {
        await run(
          db,
          upsert,
          id,
          str(b.name, 180),
          str(b.category, 80),
          b.bulk
            ? "a granel (kg)"
            : b.weight === "a granel (kg)"
              ? "Unidade"
              : String(b.weight || "").slice(0, 60),
          price,
          stock,
          b.active ? 1 : 0,
        );
        await run(db, "INSERT OR REPLACE INTO photos VALUES(?,?)", id, photo);
      });
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
      const logo = photoData(b.logo),
        rate = integer(b.rate, 0, 100000);
      await transaction(db, async (db) => {
        await run(db, "UPDATE brand SET logo=?,rate=? WHERE id=1", logo, rate);
        await run(
          db,
          "UPDATE settings SET phone=?,ifood=? WHERE id=1",
          phone,
          ifood,
        );
      });
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
        for (const p of stockLines(JSON.parse(o.items))) {
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
