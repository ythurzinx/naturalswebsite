import { readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

// Imports already-generated studio contact sheets. This command makes no paid
// API calls. A square crop only extracts the assigned photograph; it does not
// synthesize, recolor or replace the ingredient inside the generated image.
const file = process.argv[2];
if (!file)
  throw Error(
    "Use: node scripts/import-ai-product-photos.mjs /caminho/plano-local.json",
  );
const replacing = process.argv.includes("--replace");
const plan = JSON.parse(await readFile(resolve(file), "utf8"));
const root = new URL("../", import.meta.url);
const catalog = JSON.parse(
  await readFile(new URL("lib/catalog.json", root), "utf8"),
);
const old = JSON.parse(
  await readFile(new URL("data/product-photo-sources.json", root), "utf8"),
);
const targets = new Map(
  catalog.filter((p) => p.isGranel).map((p) => [p.id, p]),
);
const done = new Set(),
  sources = replacing ? { ...old } : {},
  sheets = [];
if (!Array.isArray(plan) || !plan.length) throw Error("Plano vazio.");
for (const sheet of plan.sort((a, b) => a.number - b.number)) {
  if (
    ![2, 3, 4].includes(sheet.side) ||
    sheet.products.length !== sheet.side ** 2 ||
    typeof sheet.path !== "string"
  )
    throw Error("Grade inválida.");
  const bytes = await readFile(sheet.path),
    meta = await sharp(bytes).metadata();
  if (
    !meta.width ||
    !meta.height ||
    meta.width !== meta.height ||
    meta.width < sheet.side * 280
  )
    throw Error("Resolução inválida.");
  const sheetSha256 = createHash("sha256").update(bytes).digest("hex");
  sheets.push({
    number: sheet.number,
    side: sheet.side,
    sha256: sheetSha256,
    width: meta.width,
    height: meta.height,
    products: sheet.products.map((p) => p.id),
  });
  for (const [i, item] of sheet.products.entries()) {
    const product = targets.get(item.id);
    if (!product || product.nome_produto !== item.name || done.has(item.id))
      throw Error(`Produto repetido ou incompatível: ${item.id}`);
    const col = i % sheet.side,
      row = Math.floor(i / sheet.side);
    const left = Math.round((col * meta.width) / sheet.side),
      top = Math.round((row * meta.height) / sheet.side);
    const width = Math.round(((col + 1) * meta.width) / sheet.side) - left;
    const height = Math.round(((row + 1) * meta.height) / sheet.side) - top;
    const size = Math.min(width, height, 640);
    const image = await sharp(bytes)
      .extract({ left, top, width, height })
      .resize(size, size, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
    const slug = `studio-${item.id}`,
      path = `/images/products/${slug}.webp`;
    await writeFile(new URL(`public${path}`, root), image);
    const caption = `Imagem ilustrativa de ${product.nome_produto}, gerada por IA. Aparência e apresentação podem variar.`;
    sources[slug] = {
      kind: "ai-generated",
      generator: "OpenAI image generation",
      styleVersion: "mundo-natural-studio-v1",
      createdAt: "2026-11-12",
      title: product.nome_produto,
      author: "Mundo Natural · criação com IA",
      license: "Ilustração gerada por IA",
      licenseUrl: "https://openai.com/policies/terms-of-use/",
      source: "https://openai.com/policies/terms-of-use/",
      path,
      sha256: createHash("sha256").update(image).digest("hex"),
      sheetSha256,
      cell: { row: row + 1, column: col + 1 },
      ids: [item.id],
      caption,
    };
    product.imagem = path;
    product.imagemLegenda = caption;
    done.add(item.id);
  }
}
if (!replacing && done.size !== targets.size)
  throw Error(
    `Cobertura incompleta: ${done.size}/${targets.size}. Catálogo não foi salvo.`,
  );
for (const [slug, photo] of Object.entries(replacing ? {} : old)) {
  if (catalog.some((p) => p.imagem === photo.path)) sources[slug] = photo;
  else await unlink(new URL(`public${photo.path}`, root));
}
await writeFile(
  new URL("lib/catalog.json", root),
  JSON.stringify(catalog, null, 2) + "\n",
);
await writeFile(
  new URL("data/product-photo-sources.json", root),
  JSON.stringify(sources, null, 2) + "\n",
);
const previous = replacing
  ? JSON.parse(
      await readFile(new URL("data/ai-photo-generation.json", root), "utf8"),
    )
  : null;
await writeFile(
  new URL("data/ai-photo-generation.json", root),
  JSON.stringify(
    {
      generator: "OpenAI image generation",
      requestedQuality: "medium",
      styleVersion: "mundo-natural-studio-v1",
      createdAt: "2026-11-12",
      description:
        "Fundo branco quente, tigela de porcelana branca, luz difusa, enquadramento 3/4, sem texto ou embalagem. Geração em grades e extração técnica dos quadros para WebP.",
      products: targets.size,
      sheets: previous?.sheets || sheets,
      ...(replacing
        ? { corrections: [...(previous.corrections || []), ...sheets] }
        : {}),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${done.size} produtos integrados com imagens de IA; ${sheets.length} pranchas de origem registradas por SHA-256.`,
);
