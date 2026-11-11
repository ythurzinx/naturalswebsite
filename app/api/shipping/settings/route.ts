import { shipping } from "@/lib/server/shipping";
import { jsonResponse, safeFailure } from "@/lib/server/http-security.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return jsonResponse(await shipping.publicSettings());
  } catch (error) {
    return safeFailure(error);
  }
}
