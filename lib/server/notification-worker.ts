import "server-only";
import { customerNotifications } from "./customer-notification-server";
import { startNotificationLoop } from "./notification-loop.mjs";
const state = globalThis as typeof globalThis & { __mnNotificationLoop?: ReturnType<typeof startNotificationLoop> };
export function startNotificationWorker() {
  if (state.__mnNotificationLoop || process.env.NODE_ENV !== "production" ||
    process.env.MN_BUILD_PHASE === "1" || process.env.NEXT_PHASE === "phase-production-build" ||
    !process.env.DATABASE_URL || !process.env.BREVO_API_KEY) return;
  state.__mnNotificationLoop = startNotificationLoop({
    prepare: () => customerNotifications.prepare(),
    drain: () => customerNotifications.drain(),
    onError: () => console.error("[notifications.worker] temporarily unavailable"),
  });
}
