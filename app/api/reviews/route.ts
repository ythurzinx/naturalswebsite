import { reviews } from "@/lib/server/review-server";
import { jsonResponse, safeFailure } from "@/lib/server/http-security.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return jsonResponse(
      await reviews.list(new URL(request.url).searchParams.get("product")),
    );
  } catch (e) {
    return safeFailure(e);
  }
}
export async function POST(request: Request) {
  return reviews.submit(request);
}
