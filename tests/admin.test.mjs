import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  hashPassword,
  verifyPassword,
  base32,
  totpCode,
  verifyTotp,
  adminConfiguration,
} from "../lib/server/admin-auth.mjs";
import {
  validateProduct,
  normalizeProductImage,
  createAdminService,
} from "../lib/server/admin-service.mjs";
import { databaseOptions } from "../lib/server/database.mjs";
const product = {
  name: "Castanha",
  category: "Castanhas",
  weightLabel: "A granel",
  isBulk: true,
  priceCents: 11999,
  costCents: null,
  active: true,
  imageSha: null,
};
test("admin passwords use salted scrypt and wrong credentials do not verify", async () => {
  const hash = await hashPassword("long-fixture-password");
  assert.ok(await verifyPassword("long-fixture-password", hash));
  assert.equal(await verifyPassword("wrong-fixture-password", hash), false);
  assert.notEqual(await hashPassword("long-fixture-password"), hash);
  assert.equal(await verifyPassword("password", "invalid"), false);
});
test("TOTP matches RFC6238 vector and rejects invalid or stale codes", () => {
  const secret = base32(Buffer.from("12345678901234567890"));
  assert.equal(totpCode(secret, 1), "287082");
  assert.equal(verifyTotp(secret, "287082", 59000), 1);
  assert.equal(verifyTotp(secret, "287082", 200000), null);
  assert.equal(verifyTotp(secret, "abcdef", 59000), null);
});
test("admin configuration fails closed with missing keys or insecure production origin", () => {
  assert.equal(adminConfiguration({}), null);
  assert.equal(
    adminConfiguration({
      APP_URL: "http://loja.example",
      NODE_ENV: "production",
    }),
    null,
  );
});
test("product editor rejects arbitrary image URLs, invalid money and unknown fields", () => {
  assert.equal(validateProduct(product, "prod-1").priceCents, 11999);
  for (const value of [
    { ...product, imageSha: "https://attacker.example/photo.svg" },
    { ...product, priceCents: -1 },
    { ...product, priceCents: 12.5 },
    { ...product, name: "<script>alert(1)</script>" },
    { ...product, accessToken: "extra" },
  ])
    assert.throws(() => validateProduct(value, "prod-1"));
  assert.throws(() => validateProduct(product, "../../escape"));
});
test("admin edits in 100 g preserve the existing per-kg storage contract", () => {
  const saved = validateProduct(
    {
      ...product,
      priceUnit: "100g",
      priceCents: 1200,
      costCents: 800,
    },
    "prod-1",
  );
  assert.equal(saved.priceCents, 12000);
  assert.equal(saved.costCents, 8000);
  assert.equal(saved.weightLabel, "A granel · preço por 100 g");
  assert.equal(saved.priceUnit, undefined);
  for (const value of [
    { ...product, priceUnit: "unit" },
    { ...product, priceUnit: "100g", priceCents: 100000001 },
    { ...product, priceUnit: "100g", priceCents: 10000001 },
    { ...product, priceUnit: "100g", costCents: 10000001 },
    { ...product, isBulk: false, priceUnit: "100g" },
  ])
    assert.throws(() => validateProduct(value, "prod-1"));
});
test("uploaded photos are reencoded and metadata is removed", async () => {
  const original = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#abcdef" },
  })
    .png()
    .withMetadata()
    .toBuffer();
  const result = await normalizeProductImage(original),
    meta = await sharp(result).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.exif, undefined);
  assert.ok(result.length < 1024 * 1024);
  await assert.rejects(
    normalizeProductImage(Buffer.from('<svg onload="alert(1)"/>')),
  );
  await assert.rejects(
    normalizeProductImage(Buffer.alloc(5 * 1024 * 1024 + 1)),
  );
});
test("unconfigured admin routes never expose catalog costs or permit writes", async () => {
  const service = createAdminService({
    config: null,
    repository: null,
    payments: null,
  });
  for (const [path, method] of [
    [["products"], "GET"],
    [["dashboard"], "GET"],
    [["products"], "POST"],
    [["images"], "POST"],
  ]) {
    const response = await service.handle(
      new Request("https://loja.example/api/admin/" + path.join("/"), {
        method,
      }),
      path,
    );
    assert.equal(response.status, 503);
    assert.equal(
      response.headers.get("cache-control"),
      "private, no-store, max-age=0",
    );
  }
});
test("database connection refuses credentials in options and requires TLS outside loopback", () => {
  assert.equal(databaseOptions({}), null);
  assert.throws(() =>
    databaseOptions({
      DATABASE_URL: "mysql://u:p@database.example/shop",
      DATABASE_SSL: "false",
    }),
  );
  assert.throws(() =>
    databaseOptions({
      DATABASE_URL: "mysql://u:p@127.0.0.1/shop?multipleStatements=true",
    }),
  );
  const local = databaseOptions({ DATABASE_URL: "mysql://u:p@127.0.0.1/shop" });
  assert.equal(local.multipleStatements, false);
  assert.equal(local.connectionLimit, 5);
});
