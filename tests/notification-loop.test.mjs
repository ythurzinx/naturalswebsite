import { test } from "node:test";
import assert from "node:assert/strict";
import { startNotificationLoop } from "../lib/server/notification-loop.mjs";
test("notification scheduling never overlaps, recovers after errors and stops cleanly", async () => {
  let prepare = 0, sends = 0, errors = 0, release, fail = false;
  const callbacks = [], cleared = [];
  const schedule = (fn, ms) => { callbacks.push({ fn, ms }); return { unref() {} }; };
  const worker = startNotificationLoop({
    prepare: async () => { prepare++; if (fail) throw Error("down"); await new Promise((r) => { release = r; }); },
    drain: async () => { sends++; }, onError: () => { errors++; }, delay: schedule, repeat: schedule,
    clearDelay: (t) => cleared.push(t), clearRepeat: (t) => cleared.push(t),
  });
  assert.deepEqual(callbacks.map((x) => x.ms), [2000, 60000]);
  const first = worker.tick(); await worker.tick(); assert.equal(prepare, 1); release(); await first; assert.equal(sends, 1);
  fail = true; await worker.tick(); assert.equal(errors, 1); assert.equal(sends, 1);
  fail = false; const recovered = worker.tick(); release(); await recovered; assert.equal(sends, 2);
  worker.stop(); await worker.tick(); assert.equal(prepare, 3); assert.equal(cleared.length, 2);
});
