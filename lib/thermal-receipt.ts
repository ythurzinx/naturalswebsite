"use client";
import type { Order } from "@/components/admin-dashboard";
import { store } from "@/lib/store";

export type PaperWidth = 58 | 80;
const SETTINGS_KEY = "mn-thermal-printer",
  PRINTED_KEY = "mn-printed-orders";
const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );

export function printerSettings(): { auto: boolean; width: PaperWidth } {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { auto: value.auto === true, width: value.width === 58 ? 58 : 80 };
  } catch {
    return { auto: false, width: 80 };
  }
}
export function savePrinterSettings(value: { auto: boolean; width: PaperWidth }) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
  } catch {}
}
// Each order prints automatically only once on this computer.
export function claimAutoPrint(id: string) {
  try {
    const printed: string[] = JSON.parse(
      localStorage.getItem(PRINTED_KEY) || "[]",
    );
    if (printed.includes(id)) return false;
    localStorage.setItem(
      PRINTED_KEY,
      JSON.stringify([...printed, id].slice(-300)),
    );
    return true;
  } catch {
    return true;
  }
}

type Line = { text: string; strong?: boolean; center?: boolean; right?: string };
function receiptLines(order: Order): Line[] {
  const delivery = order.fulfillment_mode === "delivery",
    a = order.address,
    items = (order.items || []).filter((i) => i.product_id !== "__shipping__");
  const when = new Date(order.created_at || Date.now()).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  return [
    { text: store.name.toUpperCase(), strong: true, center: true },
    { text: `Taboão da Serra · ${store.phoneLabel}`, center: true },
    { text: "-" },
    {
      text: `${order.state === "paid" ? "PEDIDO PAGO" : "PEDIDO"} · ${delivery ? "ENTREGA" : "RETIRADA NA LOJA"}`,
      strong: true,
    },
    { text: when },
    { text: `Cliente: ${order.customer_name || "—"}` },
    ...(order.customer_phone ? [{ text: `Telefone: ${order.customer_phone}` }] : []),
    ...(delivery && a
      ? [
          {
            text: `${a.street}, ${a.number}${a.complement ? ` (${a.complement})` : ""}`,
            strong: true,
          },
          { text: `${a.neighborhood} · ${a.city}/${a.state} · ${a.postalCode}` },
        ]
      : []),
    ...(order.estimated_minutes
      ? [{ text: `Previsão de chegada: ${order.estimated_minutes} min` }]
      : []),
    { text: "-" },
    ...items.map((i) => ({
      text: `[ ] ${i.quantity}x ${i.title}`,
      right: money(i.unit_cents * i.quantity),
    })),
    { text: "-" },
    ...(order.shipping_cents
      ? [{ text: "Frete", right: money(order.shipping_cents) }]
      : []),
    ...(order.coupon_code && order.coupon_discount_cents
      ? [
          {
            text: `Cupom ${order.coupon_code}`,
            right: `-${money(order.coupon_discount_cents)}`,
          },
        ]
      : []),
    { text: "TOTAL", right: money(order.total_cents), strong: true },
    ...(order.customer_note
      ? [{ text: "-" }, { text: `Obs.: ${order.customer_note}`, strong: true }]
      : []),
    { text: "-" },
    { text: `Ref.: ${order.id.slice(-10)}`, center: true },
    { text: "Não é documento fiscal", center: true },
  ];
}

// Prints in a hidden frame. With the store computer's browser set to print
// silently to the thermal printer, nothing else needs to be clicked.
export function printOrderReceipt(order: Order, width: PaperWidth = printerSettings().width) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.title = "Impressão do pedido";
  Object.assign(frame.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });
  document.body.append(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write("<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
  doc.close();
  doc.title = "Pedido · Mundo Natural";
  const inner = width === 58 ? 48 : 72;
  const style = doc.createElement("style");
  style.textContent = `@page{size:${width}mm auto;margin:0}*{box-sizing:border-box}body{margin:0;padding:2mm;width:${inner}mm;font:${width === 58 ? 11 : 12.5}px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#000}p{margin:0 0 1mm;overflow-wrap:anywhere;display:flex;justify-content:space-between;gap:2mm}p.center{justify-content:center;text-align:center}p.strong{font-weight:700}p.rule{border-top:1px dashed #000;margin:1.5mm 0}span.right{white-space:nowrap;font-weight:700}`;
  doc.head.append(style);
  for (const line of receiptLines(order)) {
    const p = doc.createElement("p");
    if (line.text === "-") p.className = "rule";
    else {
      p.className = [line.center ? "center" : "", line.strong ? "strong" : ""]
        .filter(Boolean)
        .join(" ");
      const left = doc.createElement("span");
      left.textContent = line.text;
      p.append(left);
      if (line.right) {
        const right = doc.createElement("span");
        right.className = "right";
        right.textContent = line.right;
        p.append(right);
      }
    }
    doc.body.append(p);
  }
  const cleanup = () => setTimeout(() => frame.remove(), 10000);
  win.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(() => frame.remove(), 120000);
  win.focus();
  win.print();
}
