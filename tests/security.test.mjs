import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { securityHeaders } from "../security-headers.mjs";
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
test("the legacy administration route fails closed", async () => {
  const source = await readFile(
    new URL("../app/admin/page.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(source.includes("notFound()"));
  assert.equal(source.includes("ADMIN_PASSWORD"), false);
});
