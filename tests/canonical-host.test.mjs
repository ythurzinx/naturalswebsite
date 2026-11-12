import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalPageRedirect } from "../lib/canonical-host.mjs";

test("www pages redirect to the configured merchant origin with path and query intact", () => {
  assert.equal(
    canonicalPageRedirect(
      "http://localhost:3000/checkout?source=menu&next=%2Fprodutos",
      "https://loja.example",
      "www.loja.example",
    ),
    "https://loja.example/checkout?source=menu&next=%2Fprodutos",
  );
  assert.equal(
    canonicalPageRedirect(
      "https://www.loja.example/admin",
      "https://loja.example",
    ),
    "https://loja.example/admin",
  );
  assert.equal(
    canonicalPageRedirect(
      "https://loja.example/admin",
      "https://www.loja.example",
    ),
    "https://www.loja.example/admin",
  );
});
test("canonical redirects do not loop or redirect unrelated hosts", () => {
  for (const host of [
    "loja.example",
    "localhost:3000",
    "127.0.0.1:3000",
    "other.example",
    "www.loja.example.evil.example",
    "www.loja.example,evil.example",
  ])
    assert.equal(
      canonicalPageRedirect(
        "https://loja.example/admin",
        "https://loja.example",
        host,
      ),
      null,
    );
});
test("untrusted paths and malformed hosts cannot choose a redirect destination", () => {
  const redirect = canonicalPageRedirect(
    "http://localhost:3000//evil.example/path?next=https://evil.example",
    "https://loja.example",
    "www.loja.example",
  );
  assert.equal(new URL(redirect).origin, "https://loja.example");
  for (const host of [
    "user@www.loja.example",
    "www.loja.example/path",
    "www.loja.example?next=evil",
    "www.loja.example#evil",
  ])
    assert.equal(
      canonicalPageRedirect(
        "http://localhost:3000/",
        "https://loja.example",
        host,
      ),
      null,
    );
});
test("invalid or insecure canonical settings do not activate redirects", () => {
  for (const origin of [
    "",
    "garbage",
    "http://loja.example",
    "https://user:pass@loja.example",
    "https://loja.example/path",
    "https://loja.example/?next=evil",
    "https://loja.example/#evil",
  ])
    assert.equal(
      canonicalPageRedirect("https://www.loja.example/", origin),
      null,
    );
});
