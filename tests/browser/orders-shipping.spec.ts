import { test, expect } from "@playwright/test";
const settings = {
  enabled: true,
  originPostalCode: "06754000",
  pricePerKmCents: 300,
  baseFeeCents: 200,
  minimumFeeCents: 800,
  maxDistanceMeters: 10000,
  freeAboveCents: 15000,
  revision: 3,
};

test("delivery quote and full address reach checkout with the displayed total", async ({
  page,
}, info) => {
  let calls = 0;
  await page.route("**/api/shipping/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/settings")) return route.fulfill({ json: settings });
    if (path.endsWith("/session"))
      return route.fulfill({ json: { csrfToken: "shipping-fixture" } });
    const body = route.request().postDataJSON();
    expect(route.request().headers()["x-csrf-token"]).toBe("shipping-fixture");
    expect(body.expectedSubtotalCents).toBe(1200);
    return route.fulfill({
      json: {
        revision: 3,
        subtotalCents: 1200,
        feeCents: 800,
        distanceMeters: 1500,
        quoteToken: "signed-fixture",
        expiresAt: Date.now() + 600000,
        address: {
          postalCode: "06754100",
          street: "Rua de teste",
          neighborhood: "Centro",
          city: "Taboão da Serra",
          state: "SP",
        },
      },
    });
  });
  await page.route("**/api/checkout/session", (route) =>
    route.fulfill({
      json: { available: true, csrfToken: "checkout-fixture", testMode: true },
    }),
  );
  await page.route("**/api/checkout", async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    expect(body.expectedTotalCents).toBe(2000);
    expect(body.fulfillment).toBe("delivery");
    expect(body.delivery).toEqual({
      quoteToken: "signed-fixture",
      number: "22",
      complement: "Apto 2",
    });
    expect(body.phone).toBe("11999999999");
    expect(body.notes).toBe("Entregar na portaria");
    expect(body.feeCents).toBeUndefined();
    await route.fulfill({
      status: 502,
      json: { error: "Pagamento de teste indisponível." },
    });
  });
  await page.goto("/produtos?q=Castanha%20de%20Caju%20Crua");
  await page
    .getByRole("button", { name: "Só essenciais", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Castanha de Caju Crua", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Adicionar ao carrinho", exact: true })
    .click();
  await page.goto("/checkout");
  await page.getByLabel("Seu nome", { exact: true }).fill("Cliente Teste");
  await page
    .getByLabel("E-mail para o pagamento", { exact: true })
    .fill("cliente@example.invalid");
  await page.getByText("Receber em casa", { exact: true }).click();
  await page.getByLabel("CEP de entrega", { exact: true }).fill("06754-100");
  await page
    .getByRole("button", { name: "Calcular frete", exact: true })
    .click();
  await expect(page.locator(".shipping-result")).toContainText("8,00");
  await page.getByLabel("Número ou s/n", { exact: true }).fill("22");
  await page
    .getByLabel("Complemento (opcional)", { exact: true })
    .fill("Apto 2");
  await page
    .getByLabel("Telefone para contato", { exact: true })
    .fill("11999999999");
  await page
    .getByLabel("Observações (opcional)", { exact: true })
    .fill("Entregar na portaria");
  await expect(page.locator(".summary-total")).toContainText("20,00");
  const pay = info.project.name.startsWith("mobile")
    ? page.getByRole("button", { name: "Pagar agora", exact: true })
    : page.getByRole("button", { name: /Pagar .* com Mercado Pago/ });
  await pay.click();
  await expect(page.locator(".payment-error[role=alert]")).toContainText(
    "Pagamento de teste indisponível.",
  );
  expect(calls).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.getByLabel("CEP de entrega", { exact: true }).fill("06754101");
  await expect(page.locator(".shipping-result")).toHaveCount(0);
  await expect(pay).toBeDisabled();
});

test("admin sound activation, live paid alerts, packing and shipping settings work on mobile", async ({
  page,
}, info) => {
  let emit = false,
    packingWrites = 0,
    settingsWrites = 0,
    feedCursor = 0;
  const order = {
    id: "ORD01MNADMINOPSFIXTURE",
    customer_name: "Cliente Teste",
    customer_email: "cliente@example.invalid",
    customer_phone: "11999999999",
    whatsapp_opt_in: true,
    estimated_minutes: null as number | null,
    state: "paid",
    fulfillment_mode: "delivery",
    fulfillment_status: "new",
    total_cents: 4400,
    paid_cents: 4400,
    shipping_cents: 800,
    distance_m: 1500,
    fee_cents: 200,
    delivery_cost_cents: null as number | null,
    staff_note: "",
    courier_name: "",
    created_at: Date.now(),
    address: {
      postalCode: "06754100",
      street: "Rua de teste",
      number: "22",
      complement: "Apto 2",
      neighborhood: "Centro",
      city: "Taboão da Serra",
      state: "SP",
    },
    items: [
      {
        line_key: "prod-1:300",
        product_id: "prod-1",
        title: "Castanha · 300 g",
        quantity: 1,
        unit_cents: 3600,
        cost_unit_cents: 2400,
        packed: 0,
      },
    ],
  };
  await page.addInitScript(() => {
    let count = 0;
    window.addEventListener("mn-order-sound", () => {
      count++;
      document.documentElement.dataset.soundCount = String(count);
    });
  });
  await page.route("**/api/admin/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.slice("/api/admin/".length),
      method = route.request().method();
    let json: unknown = {};
    if (path === "notifications/drain")
      return route.fulfill({ json: { processed: 0 } });
    if (path === "session")
      json = {
        available: true,
        authenticated: true,
        username: "admin",
        csrfToken: "admin-fixture",
        mfa: true,
      };
    else if (path === "dashboard")
      json = {
        orders: 1,
        pending: 0,
        grossCents: 4400,
        profitCents: null,
        chart: [],
        catalogHealth: {
          total: 1,
          active: 1,
          missingPhotos: 1,
          missingCosts: 0,
        },
        topProducts: [],
      };
    else if (path === "order-alerts") {
      const after = url.searchParams.get("after");
      const events =
        emit && after !== null && Number(after) < 1
          ? [
              {
                id: 1,
                order_id: order.id,
                kind: "paid",
                state: "paid",
                current_state: "paid",
                total_cents: 4400,
                created_at: Date.now(),
              },
            ]
          : [];
      if (events.length) feedCursor = 1;
      json = {
        cursor: feedCursor,
        events,
        counts: { toPack: 1, ready: 0, pending: 0 },
        hasMore: false,
      };
    } else if (path === "shipping") {
      if (method === "PUT") {
        settingsWrites++;
        expect(route.request().headers()["x-csrf-token"]).toBe("admin-fixture");
        expect(route.request().postDataJSON()).toMatchObject({
          pricePerKmCents: 450,
          minimumFeeCents: 800,
          revision: 3,
        });
        json = { ...settings, pricePerKmCents: 450, revision: 4 };
      } else json = settings;
    } else if (path === "orders") json = { orders: [order] };
    else if (path === `orders/${order.id}`) json = { order };
    else if (path === `orders/${order.id}/packing`) {
      packingWrites++;
      expect(route.request().postDataJSON()).toEqual({
        lineKey: "prod-1:300",
        packed: true,
      });
      order.items[0].packed = 1;
      json = { order };
    } else if (path === `orders/${order.id}/operations`) {
      const body = route.request().postDataJSON();
      expect(body).toEqual({
        staffNote: "Bancada 2",
        courierName: "Entregador teste",
        deliveryCostCents: 600,
        estimatedMinutes: 30,
      });
      Object.assign(order, {
        staff_note: body.staffNote,
        courier_name: body.courierName,
        delivery_cost_cents: body.deliveryCostCents,
        estimated_minutes: body.estimatedMinutes,
      });
      json = { order };
    } else throw Error("Unexpected fixture API path " + path);
    await route.fulfill({ json });
  });
  await page.goto("/admin");
  await expect(
    page.getByText("Acompanhando pedidos", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ativar avisos sonoros", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Silenciar avisos", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.locator("html").getAttribute("data-sound-count"))
    .toBe("1");
  emit = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByText("Pedido pago! Pode iniciar a separação.", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.locator("html").getAttribute("data-sound-count"))
    .toBe("2");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".order-toast")).toHaveCount(1);
  await page.locator(".order-toast").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Rua de teste");
  await expect(
    dialog.getByRole("heading", { name: "Dados do cliente" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "cliente@example.invalid" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Autorizado pelo cliente neste pedido"),
  ).toBeVisible();
  await dialog.getByRole("checkbox").click();
  await expect(dialog.getByRole("checkbox")).toBeChecked();
  await expect.poll(() => packingWrites).toBe(1);
  await expect(
    dialog.getByText("1/1 itens conferidos", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Observação interna (não vai para o cliente)", { exact: true })
    .fill("Bancada 2");
  await dialog
    .getByLabel("Entregador ou serviço", { exact: true })
    .fill("Entregador teste");
  await dialog.getByLabel(/^Previsão de chegada/).fill("30");
  await dialog
    .getByLabel("Custo real da entrega (R$)", { exact: true })
    .fill("6,00");
  await dialog
    .getByRole("button", { name: "Salvar informações da equipe", exact: true })
    .click();
  await expect(
    dialog.getByText("O lucro fica pendente", { exact: false }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Fechar janela", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Painel administrativo" })
    .getByRole("button", { name: "Frete e entregas", exact: true })
    .click();
  await page.getByLabel("Valor por km (R$)", { exact: true }).fill("4,50");
  await page
    .getByRole("button", { name: "Salvar configuração do frete", exact: true })
    .click();
  await expect.poll(() => settingsWrites).toBe(1);
  await expect(page.getByText("Frete salvo.", { exact: false })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  if (info.project.name === "mobile-390") {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({
      path: info.outputPath("frete-admin-celular.png"),
      fullPage: true,
    });
  }
});
