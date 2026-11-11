import "server-only";
import catalog from "@/lib/catalog.json";
import policy from "@/lib/sales-policy.json";
import { createDatabase } from "./database.mjs";
import { ShopRepository } from "./shop-repository.mjs";
const pool = createDatabase({
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_SSL: process.env.DATABASE_SSL,
});
export const repository = pool
  ? new ShopRepository(pool, catalog, policy)
  : null;
export async function publicCatalog(fallback = false) {
  if (repository) {
    try {
      return await repository.catalog(false);
    } catch (error) {
      if (!fallback) throw error;
      console.error(
        "[catalog] database unavailable; payment validation will fail closed",
      );
    }
  }
  return catalog.filter(
    (product) => !(policy.disabledProductIds as string[]).includes(product.id),
  );
}
