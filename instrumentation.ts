export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.MN_BUILD_PHASE !== "1") {
    const { startNotificationWorker } = await import("./lib/server/notification-worker");
    startNotificationWorker();
  }
}
