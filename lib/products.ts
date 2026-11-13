import data from "./catalog.json";
import catalogGroups from "./catalog-groups.json";
import type { Product } from "./types";
import policy from "./sales-policy.json";
import defaults from "./merchandising-defaults.json";
import { defaultProductVisible } from "./catalog-visibility.mjs";
import { findProducts } from "./search.mjs";
import { applyMerchandising } from "./merchandising.mjs";
export const products: Product[] = applyMerchandising(
  data.filter((p) => defaultProductVisible(p, policy)),
  defaults,
);
export async function fetchProducts(): Promise<Product[]> {
  return products;
}
export function getCategories(items: Product[]) {
  return [...new Set(items.map((p) => p.categoria))].sort();
}
export function getProductsByCategory(items: Product[], category: string) {
  return items.filter((p) => p.categoria === category);
}
export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
export function searchProducts(items: Product[], query: string) {
  return findProducts(items, query) as Product[];
}
export function formatPrice(price: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}
export const groups = [
  "Todos",
  "Castanhas",
  "Grãos e sementes",
  "Chás e ervas",
  "Farinhas e pós",
  "Temperos",
  "Mercearia",
  "Combos",
  "Cuidados e suplementos",
];
export function inGroup(product: Product, group: string) {
  const name = normalize(product.nome_produto);
  if (group === "Todos") return true;
  if (group === "Combos") return !!product.combo;
  if (product.combo) return false;
  if (groups.includes(product.categoria)) return product.categoria === group;
  const known = (catalogGroups as Record<string, string>)[product.id];
  if (known) return known === group;
  if (group === "Farinhas e pós")
    return /farinha| em po|maca peruana|psyllium|colageno|glutamina|creatina/.test(
      name,
    );
  if (group === "Castanhas")
    return /castanha|amendoim|nozes|amendoa|avela|pistache/.test(name);
  if (group === "Grãos e sementes")
    return /aveia|semente|chia|quinu|quinoa|linhaca|grao|arroz|feijao|lentilha|granola/.test(
      name,
    );
  if (group === "Chás e ervas")
    return /cha |hibisco|camomila|erva|cavalinha|espinheira|capim|hortela|boldo|folha|melissa/.test(
      name,
    );
  if (group === "Suplementos" || group === "Cuidados e suplementos")
    return /Suplementos|Fitoterápicos/.test(product.categoria);
  if (group === "Temperos")
    return /tempero|curcuma|acafrao|pimenta|paprica|oregano|cominho|alho|cebola|canela|cravo|sal rosa/.test(
      name,
    );
  if (group === "Mercearia")
    return /mercearia|alimentícios/.test(product.categoria);
  return true;
}
export function productTile(product: Product) {
  const name = normalize(product.nome_produto);
  if (/castanha de caju/.test(name)) return 0;
  if (/castanha|amendoim|nozes|amendoa|mix de frutas/.test(name)) return 1;
  if (/hibisco|cha |erva|camomila|folha|cavalinha/.test(name)) return 3;
  if (/chia|semente|linhaca/.test(name)) return 4;
  if (inGroup(product, "Temperos")) return 5;
  return 2;
}
const names = [
  "Castanha de Caju Crua",
  "Mix de Castanhas Nobres",
  "Aveia Flocos Finos",
  "Semente de Chia",
  "Hibisco Em Pó",
  "Pasta de Amendoim Tradicional",
];
export const featured = names
  .map((name) => products.find((p) => p.nome_produto === name))
  .filter((p): p is Product => !!p);
