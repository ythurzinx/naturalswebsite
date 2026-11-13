import { shipping } from "@/lib/server/shipping";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return shipping.preview(request);
}
