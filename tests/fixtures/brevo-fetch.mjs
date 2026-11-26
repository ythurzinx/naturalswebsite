// Loaded only by test:worker through NODE_OPTIONS. No real external requests
// are permitted from the disposable production process.
import { appendFileSync } from "node:fs";
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (url.origin !== "https://api.brevo.com") throw Error("External network disabled in worker fixture");
  if (url.pathname === "/v3/senders" && options.method === "GET") {
    appendFileSync(process.env.MN_WORKER_FIXTURE_LOG, JSON.stringify({ kind: "sender" }) + "\n");
    return Response.json({ senders: [{ email: "pedidos@loja.example", active: true }] });
  }
  if (url.pathname === "/v3/smtp/email" && options.method === "POST") {
    const body = JSON.parse(options.body);
    if (body.to?.length !== 1 || body.to[0].email !== "worker@example.invalid") throw Error("Invalid fixture recipient");
    appendFileSync(process.env.MN_WORKER_FIXTURE_LOG, JSON.stringify({ kind: "email", body }) + "\n");
    return Response.json({ messageId: "local-fixture" }, { status: 201 });
  }
  throw Error("Unexpected provider call in worker fixture");
};
