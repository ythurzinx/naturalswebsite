const validEmail = (value) => typeof value === "string" && value.length <= 180 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value);
export function createBrevoSender({ apiKey, senderEmail = "", origin, fetcher = fetch, now = Date.now }) {
  let cached = null, expires = 0, pending = null;
  let domain = "";
  try { const url = new URL(origin); if (url.protocol === "https:" && !url.username && !url.password) domain = url.hostname.replace(/^www\./, "").toLowerCase(); } catch { /* Origin isn't suitable for automatic sender selection. */ }
  async function discover() {
    if (!apiKey) return { state: "missing_key", email: "", source: null };
    if (validEmail(senderEmail)) return { state: "configured", email: senderEmail, source: "environment" };
    if (!domain || !domain.includes(".") || domain.endsWith(".invalid")) return { state: "missing_domain", email: "", source: null };
    try {
      const response = await fetcher(`https://api.brevo.com/v3/senders?domain=${encodeURIComponent(domain)}`, {
        method: "GET", headers: { "api-key": apiKey, accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) { await response.body?.cancel(); return { state: response.status === 401 || response.status === 403 ? "invalid_key" : "provider_unavailable", email: "", source: null }; }
      const reader = response.body?.getReader(), chunks = [];
      let size = 0;
      if (!reader) return { state: "provider_unavailable", email: "", source: null };
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 200000) { await reader.cancel(); return { state: "provider_unavailable", email: "", source: null }; }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!Array.isArray(data.senders) || data.senders.length > 1000) return { state: "provider_unavailable", email: "", source: null };
      const candidates = data.senders.filter((s) => s?.active === true && validEmail(s.email) && s.email.split("@")[1].toLowerCase() === domain);
      const priorities = ["pedidos", "contato", "atendimento", "noreply", "no-reply"];
      const rank = (email) => { const index = priorities.indexOf(email.split("@")[0].toLowerCase()); return index < 0 ? 100 : index; };
      candidates.sort((a, b) => rank(a.email) - rank(b.email) || a.email.localeCompare(b.email));
      return candidates.length ? { state: "verified", email: candidates[0].email, source: "verified_domain" } : { state: "sender_required", email: "", source: null };
    } catch { return { state: "provider_unavailable", email: "", source: null }; }
  }
  async function resolve() {
    if (cached && expires > now()) return cached;
    if (pending) return pending;
    pending = discover().then((value) => { cached = value; expires = now() + (value.email ? 300000 : 30000); return value; }).finally(() => { pending = null; });
    return pending;
  }
  return { resolve };
}
