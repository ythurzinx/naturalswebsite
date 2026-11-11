import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseConsent,
  saveConsent,
  CONSENT_KEY,
  FAVORITES_KEY,
  CONSENT_EVENT,
} from "../lib/privacy.mjs";
const now = 1800000000000;
test("consent is explicit, versioned and expires after 180 days", () => {
  const valid = { version: 1, preferences: false, savedAt: now };
  assert.equal(parseConsent(JSON.stringify(valid), now).preferences, false);
  for (const value of [
    "invalid",
    "null",
    JSON.stringify({ ...valid, preferences: "yes" }),
    JSON.stringify({ ...valid, version: 0 }),
    JSON.stringify({ ...valid, savedAt: now + 1 }),
    JSON.stringify({ ...valid, savedAt: now - 180 * 86400000 }),
  ])
    assert.equal(parseConsent(value, now), null);
});
test("refusing optional storage removes saved favorites and emits the change", () => {
  const values = new Map([[FAVORITES_KEY, '["oats"]']]);
  const events = [];
  globalThis.window = {
    localStorage: {
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    },
    dispatchEvent: (e) => events.push(e),
  };
  const consent = saveConsent(false);
  assert.equal(consent.preferences, false);
  assert.equal(values.has(FAVORITES_KEY), false);
  assert.equal(JSON.parse(values.get(CONSENT_KEY)).necessary, true);
  assert.equal(events[0].type, CONSENT_EVENT);
  delete globalThis.window;
});
test("blocked storage does not throw or stop consent interaction", () => {
  globalThis.window = {
    localStorage: {
      setItem: () => {
        throw Error("blocked");
      },
    },
    dispatchEvent: () => true,
  };
  assert.doesNotThrow(() => saveConsent(true));
  delete globalThis.window;
});
