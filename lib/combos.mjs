import seed from "../data/combo-seed.json" with { type: "json" };
import { randomUUID } from "node:crypto";

export const comboSchema = [
  "CREATE TABLE IF NOT EXISTS combos(key TEXT PRIMARY KEY, name TEXT, description TEXT, image TEXT, members TEXT, price INTEGER, active INTEGER, revision INTEGER)",
  ...seed.map((c) => ({
    sql: "INSERT OR IGNORE INTO combos VALUES(?,?,?,?,?,0,1,1)",
    args: [c.key, c.name, c.description, c.image, JSON.stringify(c.members)],
  })),
];
function reject(message, status = 400) {
  throw Object.assign(Error(message), { status });
}
export async function listCombos(db, privateView = false, key = null) {
  const rows = (
    await db.execute({
      sql: `SELECT c.*, json_extract(m.value,'$.id') AS sku, json_extract(m.value,'$.qty') AS units,p.name AS productName,p.price AS unitPrice,p.stock,p.weight,(p.active AND p.weight != 'a granel (kg)') AS listed FROM combos c JOIN json_each(c.members) m LEFT JOIN products p ON p.id=json_extract(m.value,'$.id') WHERE (?=1 OR c.active=1) AND (? IS NULL OR c.key=?) ORDER BY c.rowid,m.key`,
      args: [Number(privateView), key, key],
    })
  ).rows;
  const grouped = new Map();
  for (const r of rows) {
    if (!grouped.has(r.key))
      grouped.set(r.key, {
        id: "kit:" + r.key + ":" + r.revision,
        key: r.key,
        name: r.name,
        description: r.description,
        image: r.image,
        active: r.active,
        customPrice: r.price,
        price: 0,
        available: true,
        members: [],
      });
    const c = grouped.get(r.key);
    c.members.push({
      id: r.sku,
      name: r.productName || r.sku,
      qty: r.units,
      weight: r.weight || "",
    });
    c.price += r.units * (r.unitPrice || 0);
    c.available &&= !!r.listed && r.unitPrice > 0 && r.stock >= r.units;
  }
  return [...grouped.values()].map((c) => ({
    ...c,
    price: c.customPrice || c.price,
  }));
}
export async function saveCombo(tx, b) {
  if (
    typeof b.name !== "string" ||
    !b.name.trim() ||
    b.name.length > 80 ||
    typeof b.description !== "string" ||
    b.description.length > 180 ||
    !["cafe", "lanche", "granolas", "neutra"].includes(b.image) ||
    !Number.isSafeInteger(b.price) ||
    b.price < 0 ||
    b.price > 99999999
  )
    reject("Confira nome, descrição e preço do combo.");
  if (
    !Array.isArray(b.members) ||
    b.members.length < 2 ||
    b.members.length > 15
  )
    reject("Escolha de 2 a 15 produtos diferentes.");
  const ids = new Set(),
    members = [];
  for (const p of b.members) {
    if (
      typeof p.id !== "string" ||
      ids.has(p.id) ||
      !Number.isSafeInteger(p.qty) ||
      p.qty < 1 ||
      p.qty > 99 ||
      !(
        await tx.execute({
          sql: "SELECT 1 FROM products WHERE id=?",
          args: [p.id],
        })
      ).rows.length
    )
      reject(
        "Confira os códigos e quantidades. Cada produto deve aparecer uma vez.",
      );
    ids.add(p.id);
    members.push({ id: p.id, qty: p.qty });
  }
  const fields = [
    b.name.trim(),
    b.description.trim(),
    b.image,
    JSON.stringify(members),
    b.price,
    Number(!!b.active),
  ];
  if (!b.key) {
    await tx.execute({
      sql: "INSERT INTO combos VALUES(?,?,?,?,?,?,?,1)",
      args: [randomUUID(), ...fields],
    });
    return;
  }
  if (
    !(
      await tx.execute({
        sql: "UPDATE combos SET name=?,description=?,image=?,members=?,price=?,active=?,revision=revision+1 WHERE key=? AND revision=?",
        args: [...fields, b.key, b.revision],
      })
    ).rowsAffected
  )
    reject("O combo mudou. Reabra a edição.", 409);
}
export function stockLines(items) {
  const units = new Map();
  for (const line of items)
    for (const member of line.members || [{ id: line.id, qty: 1 }])
      units.set(member.id, (units.get(member.id) || 0) + line.qty * member.qty);
  return [...units].map(([id, qty]) => ({ id, qty }));
}
