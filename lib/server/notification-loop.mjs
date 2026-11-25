// Timers only schedule the durable outbox. Its database claims provide the
// deduplication across processes, webhooks and the optional external worker.
export function startNotificationLoop({ prepare, drain, delay = setTimeout, repeat = setInterval, clearDelay = clearTimeout, clearRepeat = clearInterval, onError = () => {} }) {
  let running = false, stopped = false;
  async function tick() {
    if (running || stopped) return;
    running = true;
    try { await prepare(); if (!stopped) await drain(); }
    catch { onError(); }
    finally { running = false; }
  }
  const initial = delay(() => void tick(), 2000), timer = repeat(() => void tick(), 60000);
  initial?.unref?.(); timer?.unref?.();
  return { tick, stop() { stopped = true; clearDelay(initial); clearRepeat(timer); } };
}
