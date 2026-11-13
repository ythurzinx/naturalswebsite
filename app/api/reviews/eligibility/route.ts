import { reviews } from "@/lib/server/review-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return reviews.eligibility(request);
}
