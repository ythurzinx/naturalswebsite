import { test } from "node:test";
import assert from "node:assert/strict";
import { createBrevoSender } from "../lib/server/brevo-sender.mjs";
const config = { apiKey: "fixture-private-key", origin: "https://www.loja.example" };
test("Brevo discovers only active senders from the configured store domain and coalesces requests", async () => {
  let calls = 0, time = 1000;
  const sender = createBrevoSender({ ...config, now: () => time, fetcher: async (url, options) => {
    calls++; assert.equal(url, "https://api.brevo.com/v3/senders?domain=loja.example");
    assert.equal(options.redirect, "error"); assert.equal(options.method, "GET");
    assert.equal(options.headers["api-key"], config.apiKey);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return Response.json({ senders: [
      { email: "pedidos@other.example", active: true }, { email: "pedidos@loja.example", active: false },
      { email: "z@loja.example", active: true }, { email: "contato@loja.example", active: true },
      { email: "bad\r\n@loja.example", active: true },
    ] });
  } });
  const [first, second] = await Promise.all([sender.resolve(), sender.resolve()]);
  assert.deepEqual(first, { state: "verified", email: "contato@loja.example", source: "verified_domain" });
  assert.deepEqual(first, second); assert.equal(calls, 1);
  await sender.resolve(); assert.equal(calls, 1);
  time += 300001; await sender.resolve(); assert.equal(calls, 2);
});
test("sender selection supports explicit configuration without guessing addresses", async () => {
  const never = async () => { throw Error("unexpected request"); };
  assert.equal((await createBrevoSender({ ...config, apiKey: "", fetcher: never }).resolve()).state, "missing_key");
  assert.deepEqual(await createBrevoSender({ ...config, senderEmail: "existing@brand.example", fetcher: never }).resolve(),
    { state: "configured", email: "existing@brand.example", source: "environment" });
  const empty = await createBrevoSender({ ...config, fetcher: async () => Response.json({ senders: [{ email: "x@other.example", active: true }] }) }).resolve();
  assert.deepEqual(empty, { state: "sender_required", email: "", source: null });
});
test("sender discovery bounds provider data and keeps authentication failures private", async () => {
  for (const [fetcher, state] of [
    [async () => new Response("private detail", { status: 401 }), "invalid_key"],
    [async () => new Response("private detail", { status: 503 }), "provider_unavailable"],
    [async () => new Response("a".repeat(200001)), "provider_unavailable"],
    [async () => Response.json({ senders: {} }), "provider_unavailable"],
    [async () => { throw Error("secret private detail"); }, "provider_unavailable"],
  ]) {
    const result = await createBrevoSender({ ...config, fetcher }).resolve();
    assert.deepEqual(result, { state, email: "", source: null });
    assert.doesNotMatch(JSON.stringify(result), /private|secret|fixture/);
  }
});
