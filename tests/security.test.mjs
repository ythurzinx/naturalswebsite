import { test } from "node:test";
import assert from "node:assert/strict";
import {
  securityHeaders,
  contentSecurityPolicy,
} from "../security-headers.mjs";
test("production headers restrict framing, objects, connections and browser features", () => {
  const headers = Object.fromEntries(
    securityHeaders().map((h) => [h.key, h.value]),
  );
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  for (const directive of [
    "object-src 'none'",
    "frame-ancestors 'none'",
    "connect-src 'self'",
    "form-action 'self'",
  ])
    assert.ok(headers["Content-Security-Policy"].includes(directive));
  assert.equal(
    headers["Content-Security-Policy"].includes("unsafe-eval"),
    false,
  );
});
test("production script policy requires a nonce and blocks inline event handlers", () => {
  const policy = contentSecurityPolicy(false, "fixture-nonce");
  const scripts = policy
    .split(";")
    .find((part) => part.trim().startsWith("script-src "));
  assert.ok(scripts.includes("'nonce-fixture-nonce'"));
  assert.ok(!scripts.includes("unsafe-inline"));
  assert.ok(policy.includes("script-src-attr 'none'"));
});
