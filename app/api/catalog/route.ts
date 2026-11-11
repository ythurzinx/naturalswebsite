import { publicCatalog } from "@/lib/server/shop";
import { jsonResponse, safeFailure } from "@/lib/server/http-security.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return jsonResponse({ products: await publicCatalog() });
  } catch (error) {
    return safeFailure(error);
  }
}
