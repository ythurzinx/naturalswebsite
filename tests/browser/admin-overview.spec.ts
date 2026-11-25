import { test, expect } from "@playwright/test";

const now = Date.now();
const order = (id: string, name: string, status: string, extra = {}) => ({
  id,
  customer_name: name,
  customer_email: `${id}@example.invalid`,
  customer_phone: "11988887777",
  whatsapp_opt_in: true,
  total_cents: 4920,
  paid_cents: 4920,
  shipping_cents: 900,
  state: "paid",
  fulfillment_status: status,
  fulfillment_mode: "delivery",
  created_at: now - 20 * 60000,
  address: {
    postalCode: "06754100",
    street: "Rua das Magnólias",
    number: "22",
    complement: "",
    neighborhood: "Parque Assunção",
    city: "Taboão da Serra",
    state: "SP",
  },
  items: [
    {
      line_key: "prod-1:300",
      product_id: "prod-1",
      title: "Castanha de Caju Crua · 300 g",
      quantity: 1,
      unit_cents: 4020,
      cost_unit_cents: null,
      packed: 0,
    },
  ],
  ...extra,
});

test("the overview shows today's numbers, the order board and editable WhatsApp texts", async ({
  page,
}, info) => {
  const orders = [
    order("ORD01BOARDNEW00001", "Ana Souza", "new"),
    order("ORD01BOARDPACK0001", "Bruno Lima", "packing"),
    order("ORD01BOARDOUT00001", "Carla Dias", "out_for_delivery"),
    order("ORD01BOARDDONE0001", "Davi Reis", "completed"),
    order("ORD01BOARDWAIT0001", "Eva Luz", "new", { state: "pending", paid_cents: 0 }),
  ];
  let templates: Record<string, string> = {};
  let revision = 0;
  const saved: unknown[] = [];
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.slice("/api/admin/".length);
    let json: unknown = {};
    if (path === "notifications/drain") json = { processed: 0 };
    else if (path === "session")
      json = {
        available: true,
        authenticated: true,
        username: "admin",
        csrfToken: "ui-fixture",
        mfa: true,
      };
    else if (path === "dashboard")
      json = {
        orders: 5,
        pending: 1,
        grossCents: 19680,
        netRevenueCents: 19680,
        profitCents: null,
        expensesCents: 0,
        refundedCents: 0,
        feesCents: 0,
        costsCents: 0,
        deliveryCostsCents: 0,
        missingCosts: 0,
        missingFees: 0,
        missingRefunds: 0,
        missingDeliveryCosts: 0,
        incompletePayments: 0,
        chart: [],
        catalogHealth: { total: 1, active: 1, missingPhotos: 0, missingCosts: 0 },
        topProducts: [],
        today: { orders: 5, paidOrders: 4, grossCents: 19680, pending: 1 },
        paidOrders: 4,
        averageTicketCents: 4920,
      };
    else if (path === "order-alerts")
      json = { cursor: 0, events: [], counts: {}, hasMore: false };
    else if (path === "orders") json = { orders };
    else if (path.startsWith("orders/") && path.split("/").length === 2)
      json = { order: orders.find((o) => o.id === path.split("/")[1]) };
    else if (path.endsWith("/fulfillment")) {
      const target = orders.find((o) => o.id === path.split("/")[1])!;
      target.fulfillment_status = request.postDataJSON().state;
      json = { ok: true, order: target };
    } else if (path === "message-templates") {
      if (request.method() === "PUT") {
        expect(request.headers()["x-csrf-token"]).toBe("ui-fixture");
        const body = request.postDataJSON();
        saved.push(body);
        expect(body.revision).toBe(revision);
        templates = body.templates;
        revision++;
      }
      json = { templates, revision };
    } else throw new Error("Unexpected fixture API path: " + path);
    await route.fulfill({ json });
  });
  await page.goto("/admin");
  const cookie = page.getByRole("button", { name: "Só essenciais", exact: true });
  if (await cookie.isVisible().catch(() => false)) await cookie.click();
  await expect(page.locator(".overview-hello")).toContainText(
    "3 pedidos em andamento",
  );
  await expect(page.locator(".overview-today")).toContainText("R$ 196,80");
  await expect(page.locator(".overview-today")).toContainText("Aguardando pagamento");
  const board = page.getByRole("region", { name: "Pedidos em andamento" });
  const column = (label: string) =>
    board.locator(".board-column").filter({ hasText: label });
  await expect(column("Pagos · a separar").locator(".board-card")).toHaveCount(1);
  await expect(column("Em separação").locator(".board-card")).toHaveCount(1);
  await expect(column("Saiu para entrega")).toContainText("Carla");
  await expect(board).not.toContainText("Davi");
  await expect(board).not.toContainText("Eva");
  if (info.project.name === "mobile-390")
    await page.screenshot({ path: info.outputPath("visao-geral.png"), fullPage: true });

  // Edit the confirmation text and insert a field from the chips.
  await page
    .locator(".overview-actions")
    .getByRole("button", { name: "Mensagens" })
    .click();
  const card = page.locator(".message-template").filter({
    hasText: "Pagamento confirmado",
  });
  const textarea = card.getByLabel("Texto da mensagem");
  await textarea.fill("Oi {nome}! Pagamento ok. Total: ");
  await card.getByRole("button", { name: "Total pago" }).click();
  await expect(card.locator(".message-preview")).toContainText(
    "Oi Maria! Pagamento ok. Total: R$ 49,20",
  );
  await page.getByRole("button", { name: "Salvar mensagens" }).click();
  await expect(page.getByText("Mensagens salvas.", { exact: false })).toBeVisible();
  expect(saved).toHaveLength(1);
  expect((saved[0] as { templates: Record<string, string> }).templates.confirmed).toBe(
    "Oi {nome}! Pagamento ok. Total: {total}",
  );

  // The order opened from the board uses the edited text.
  await page
    .getByRole("navigation", { name: "Painel administrativo" })
    .getByRole("button", { name: "Visão geral" })
    .click();
  await page.evaluate(() => {
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = ((url?: string | URL) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
  });
  await page.getByRole("button", { name: "Abrir pedido de Ana Souza" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Enviar: pagamento confirmado" })
    .click();
  const opened = await page.evaluate(
    () => (window as unknown as { __opened: string[] }).__opened,
  );
  expect(decodeURIComponent(opened[0].split("text=")[1])).toBe(
    "Oi Ana! Pagamento ok. Total: R$ 49,20",
  );
  await expect.poll(() => orders[0].fulfillment_status).toBe("packing");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
