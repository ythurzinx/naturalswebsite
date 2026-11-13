import type { Product } from "@/lib/types";
import { publicCatalog } from "@/lib/server/shop";
import { productContent } from "@/lib/server/product-content-server";
import { jsonResponse, safeFailure } from "@/lib/server/http-security.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^(?:prod-\d+|custom-[a-f0-9-]{36}|combo-[a-z0-9-]{1,48})$/.test(id))
    return jsonResponse({ error: "Produto não encontrado." }, 404);
  try {
    const product = (await publicCatalog()).find((p: Product) => p.id === id);
    if (!product)
      return jsonResponse({ error: "Produto não encontrado." }, 404);
    const value = await productContent.get(product);
    return jsonResponse({ content: value.content });
  } catch (error) {
    return safeFailure(error);
  }
}
