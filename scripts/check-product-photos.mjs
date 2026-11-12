import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { defaultProductVisible } from "../lib/catalog-visibility.mjs";
const load = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const [catalog, policy, sources] = await Promise.all([
  load("../lib/catalog.json"),
  load("../lib/sales-policy.json"),
  load("../data/product-photo-sources.json"),
]);
const photos = new Map();
let size = 0;
for (const [slug, photo] of Object.entries(sources)) {
  if (
    !/^[a-z0-9-]+$/.test(slug) ||
    photo.path !== `/images/products/${slug}.webp` ||
    !/^[a-f0-9]{64}$/.test(photo.sha256) ||
    !photo.author ||
    !/^(CC0|CC BY(?:-SA)? [1-4]\.[05]|Public domain|PDM|PD)/i.test(
      photo.license,
    ) ||
    new URL(photo.source).hostname !== "commons.wikimedia.org"
  )
    throw Error(`Invalid photo source: ${slug}`);
  const bytes = await readFile(
    new URL(`../public${photo.path}`, import.meta.url),
  );
  const meta = await sharp(bytes).metadata();
  if (
    createHash("sha256").update(bytes).digest("hex") !== photo.sha256 ||
    meta.format !== "webp" ||
    !meta.width ||
    !meta.height ||
    meta.width > 640 ||
    meta.height > 640 ||
    bytes.length > 300000
  )
    throw Error(`Invalid or unoptimized photo: ${slug}`);
  photos.set(photo.path, photo);
  size += bytes.length;
}
const visible = catalog.filter((p) => defaultProductVisible(p, policy));
for (const p of visible)
  if (!photos.has(p.imagem) || !p.imagemLegenda)
    throw Error(`Missing licensed photo or caption: ${p.id}`);
console.log(
  `${visible.length} produtos com foto local e crédito; ${photos.size} arquivos WebP; ${(size / 1024 / 1024).toFixed(1)} MB no total.`,
);
