import { store } from "../store-data.mjs";
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const validMoney = (value) => Number.isSafeInteger(value) && value >= 0;
export function orderEmail(order, event, estimatedMinutes = null, origin = store.site) {
  const delivery = order.fulfillment_mode === "delivery", name = String(order.customer_name || "Cliente").trim().split(/\s+/)[0].slice(0, 80),
    id = String(order.id || "").slice(0, 80),
    title = { paid: "Pagamento confirmado!", ready: delivery ? "Seu pedido está separado" : "Tudo pronto para retirar!", out_for_delivery: "Seu pedido saiu para entrega!" }[event];
  const eta = Number.isInteger(estimatedMinutes) && estimatedMinutes >= 1 && estimatedMinutes <= 240 ? estimatedMinutes : null;
  const intro = {
    paid: "O pagamento da sua compra foi confirmado com sucesso. Confira os itens e acompanhe pelo site o andamento atualizado do pedido.",
    ready: delivery ? "Seus produtos foram conferidos, separados e embalados. O próximo passo é a saída para entrega." : "Seus produtos já foram conferidos e embalados. Você pode combinar a retirada com nossa equipe.",
    out_for_delivery: eta ? `Sua entrega está a caminho! A previsão de chegada é de aproximadamente ${eta} minutos a partir da saída. O trânsito pode alterar esse prazo.` : "Sua entrega está a caminho! Consulte nossa equipe para acompanhar a previsão de chegada.",
  }[event];
  if (!title || !intro) throw Error("Unsupported order notification");
  let base = store.site;
  try { const url = new URL(origin); if (url.protocol === "https:" && !url.username && !url.password) base = url.origin; } catch { /* Use the official store origin. */ }
  const tracking = `${base}/pagamento/retorno${id ? `?order_id=${encodeURIComponent(id)}` : ""}`, support = `https://api.whatsapp.com/send?phone=${store.phone}`;
  const groups = new Map();
  for (const item of (order.items || []).slice(0, 200)) {
    if (item.product_id === "__shipping__" || !Number.isInteger(item.quantity) || item.quantity < 1) continue;
    const combo = String(item.line_key || "").includes("|"), key = combo ? String(item.line_key).split("|")[0] : String(item.line_key || groups.size),
      label = String(item.title || "Produto").slice(0, 220),
      lineAmount = validMoney(item.unit_cents) ? item.unit_cents * item.quantity : null;
    if (groups.has(key)) {
      const line = groups.get(key); line.cents = line.cents === null || lineAmount === null ? null : line.cents + lineAmount;
    } else groups.set(key, { title: `${item.quantity} × ${combo ? label.split(" · ")[0] : label}`, cents: lineAmount });
  }
  const items = [...groups.values()];
  const totals = [
    ...(validMoney(order.shipping_cents) && order.shipping_cents > 0 ? [["Frete", money(order.shipping_cents)]] : []),
    ...(validMoney(order.coupon_discount_cents) && order.coupon_discount_cents > 0 ? [[`Economia já incluída${order.coupon_code ? ` · ${String(order.coupon_code).slice(0, 24)}` : ""}`, money(order.coupon_discount_cents)]] : []),
    ...(validMoney(order.total_cents) ? [["Total pago", money(order.total_cents)]] : []),
  ];
  const received = delivery ? "Entrega no endereço informado na compra." : `Retirada na loja: ${store.address}.`,
    next = event === "paid" ? delivery ? "Acompanhe a separação e, na saída para entrega, a previsão informada pela equipe." : "Aguarde o aviso de que o pedido está pronto antes de ir à loja." : "Se precisar de ajuda, fale com nossa equipe.",
    textContent = [
      `Olá, ${name}!`, "", title, intro, "", ...(items.length ? ["Seu pedido:", ...items.map((i) => `${i.title}${i.cents === null ? "" : ` — ${money(i.cents)}`}`), ""] : []),
      ...totals.map(([label, value]) => `${label}: ${value}`), "", received, next, "",
      `Acompanhe: ${tracking}`, "Use o mesmo navegador em que realizou a compra.", "", `Pedido: ${id}`, `${store.name} · ${store.phoneLabel}`,
      "Atualização referente à sua compra.",
    ].join("\n");
  const row = (label, value, last = false) => `<tr><td style="padding:10px 0;color:#61705f;font-size:${last ? "14" : "12"}px;${last ? "font-weight:700;border-top:1px solid #e4ebdf" : ""}">${escape(label)}</td><td align="right" style="padding:10px 0;color:#2c5137;font-size:${last ? "20" : "13"}px;white-space:nowrap;${last ? "font-weight:700;border-top:1px solid #e4ebdf" : ""}">${escape(value)}</td></tr>`;
  const itemRows = items.map((item) => `<tr><td style="padding:13px 0;border-bottom:1px solid #eff2e9;font-size:13px;line-height:1.6;color:#536a4e">${escape(item.title)}</td><td align="right" style="padding:13px 0 13px 12px;border-bottom:1px solid #eff2e9;font-size:13px;color:#536a4e;white-space:nowrap">${item.cents === null ? "" : escape(money(item.cents))}</td></tr>`).join("");
  const htmlContent = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media(max-width:600px){.mail-pad{padding:25px 20px!important}.mail-title{font-size:27px!important}.mail-shell{width:100%!important}}</style></head><body style="margin:0;padding:0;background:#f3f6ed;font-family:Arial,Helvetica,sans-serif;color:#365638"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" class="mail-shell" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #e3eadb;border-radius:18px;overflow:hidden"><tr><td class="mail-pad" style="padding:30px 34px;background:#edf4e3;border-bottom:1px solid #e0e9d5"><p style="margin:0 0 5px;font-weight:700;letter-spacing:-.5px;font-size:23px;color:#315637">Mundo Natural</p><p style="margin:0;color:#61705f;font-size:10px;letter-spacing:1.2px">TABOÃO DA SERRA · NATURALMENTE PERTO DE VOCÊ</p></td></tr><tr><td class="mail-pad" style="padding:34px"><span style="display:inline-block;border:1px solid #dce9ce;border-radius:7px;background:#f4f8ee;color:#61705f;padding:7px 10px;font-size:10px">ATUALIZAÇÃO DA SUA COMPRA</span><h1 class="mail-title" style="font-size:31px;line-height:1.2;letter-spacing:-.8px;color:#315638;margin:23px 0 19px">${escape(title)}</h1><p style="font-size:14px;margin:0 0 12px;line-height:1.8">Olá, <strong>${escape(name)}!</strong></p><p style="font-size:13px;line-height:1.9;color:#61705f;margin:0 0 25px">${escape(intro)}</p>${items.length ? `<h2 style="font-size:15px;margin:0 0 4px;color:#536e45">Seu pedido, na sua medida</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>` : ""}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:13px 0 25px">${totals.map(([label, value]) => row(label, value, label === "Total pago")).join("")}</table><div style="padding:18px;background:#f7faf1;border:1px solid #e6eddb;border-radius:11px"><strong style="font-size:12px;color:#61705f">${delivery ? "Sua entrega" : "Sua retirada"}</strong><p style="font-size:12px;line-height:1.8;margin:8px 0;color:#61705f">${escape(received)}</p><p style="font-size:12px;line-height:1.8;margin:0;color:#61705f">${escape(next)}</p></div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:25px 0 12px"><tr><td align="center" style="border-radius:9px;background:#315b3c"><a href="${escape(tracking)}" style="display:block;padding:16px;color:#fff;text-decoration:none;font-size:13px;font-weight:700">Acompanhar meu pedido</a></td></tr></table><p style="text-align:center;font-size:10px;color:#61705f;line-height:1.8;margin:0 0 26px">Abra no mesmo navegador em que realizou a compra.</p><p style="font-size:12px;line-height:1.9;color:#61705f;margin:0">Precisou de ajuda? <a href="${escape(support)}" style="color:#61705f">Fale com a nossa equipe</a> pelo ${escape(store.phoneLabel)}.</p><p style="font-size:10px;color:#61705f;line-height:1.7;margin:20px 0 0">Referência da compra: ${escape(id)}</p></td></tr></table><p style="font-size:10px;line-height:1.8;color:#61705f;margin:20px 15px 0">${escape(store.name)} · ${escape(store.city)}<br>Esta mensagem acompanha uma compra realizada na nossa loja.</p></td></tr></table></body></html>`;
  return { subject: `${title} · ${store.name}`, textContent, htmlContent };
}
