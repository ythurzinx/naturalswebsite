import { timingSafeEqual } from "node:crypto";
import { customerNotifications } from "@/lib/server/customer-notification-server";
import { repository } from "@/lib/server/shop";
import { jsonResponse, safeFailure } from "@/lib/server/http-security.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const secret = process.env.NOTIFICATION_WORKER_SECRET || "";
  const supplied = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (
    !/^[A-Za-z0-9_-]{32,128}$/.test(secret) ||
    !/^Bearer [A-Za-z0-9_-]+$/.test(supplied) ||
    supplied.length !== expected.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return jsonResponse({ error: "Não autorizado." }, 401);
  try {
    if (!repository)
      return jsonResponse({ error: "Serviço indisponível." }, 503);
    if (!(await repository.loginLimit("notification-worker", 1, 10000)))
      return jsonResponse({ processed: 0 });
    return jsonResponse(await customerNotifications.drain());
  } catch (error) {
    return safeFailure(error);
  }
}
