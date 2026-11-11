import sharp from "sharp";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const directory = new URL("../public/images/", import.meta.url);
const jobs = [
  ["natural-bowls.png", "natural-bowls.webp", 1536],
  ["mundo-natural-logo.png", "mundo-natural-logo.webp", 384],
  ["loja-mundo-natural.jpg", "loja-mundo-natural.webp", 1280],
];
let before = 0,
  after = 0;
for (const [source, target, width] of jobs) {
  const input = fileURLToPath(new URL(source, directory));
  const output = fileURLToPath(new URL(target, directory));
  await sharp(input)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 84, effort: 6 })
    .toFile(output);
  before += (await stat(input)).size;
  after += (await stat(output)).size;
}
await sharp(fileURLToPath(new URL("mundo-natural-logo.png", directory)))
  .resize(192, 192)
  .png({ compressionLevel: 9 })
  .toFile(fileURLToPath(new URL("mundo-natural-icon.png", directory)));
console.log(
  `Imagens principais: ${(before / 1048576).toFixed(2)} MB → ${(after / 1048576).toFixed(2)} MB (${Math.round((1 - after / before) * 100)}% menos bytes). Originais preservados.`,
);
