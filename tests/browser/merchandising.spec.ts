import { test, expect } from "@playwright/test";

test("private Mercado Pago homologation returns to the admin and never calls the storefront checkout", async ({
  page,
}) => {
  let created = 0,
    storeCalls = 0,
    state = "none";
  await page.route("**/api/checkout", (route) => {
    storeCalls++;
    return route.fulfill({
      status: 500,
      json: { error: "Store checkout must not be used" },
    });
  });
  await page.route("**/api/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      "/api/admin/",
      "",
    );
    if (path === "notifications/drain")
      return route.fulfill({ json: { processed: 0 } });
    if (path === "session")
      return route.fulfill({
        json: {
          available: true,
          authenticated: true,
          username: "admin",
          csrfToken: "admin-fixture",
          mfa: true,
        },
      });
    if (path === "order-alerts")
      return route.fulfill({
        json: {
          cursor: 0,
          events: [],
          counts: { toPack: 0, ready: 0, pending: 0 },
        },
      });
    if (path === "payments/test/session")
      return route.fulfill({
        json: { available: true, testMode: true, csrfToken: "sandbox-initial" },
      });
    if (path === "payments/test/reset") {
      expect(route.request().headers()["x-csrf-token"]).toBe("admin-fixture");
      expect(route.request().postDataJSON()).toEqual({
        csrfToken: "sandbox-initial",
      });
      return route.fulfill({
        json: { available: true, testMode: true, csrfToken: "sandbox-fresh" },
      });
    }
    if (path === "payments/test/checkout") {
      expect(route.request().headers()["x-csrf-token"]).toBe("admin-fixture");
      expect(route.request().postDataJSON()).toMatchObject({
        csrfToken: "sandbox-fresh",
        input: {
          email: "teste@example.invalid",
          items: [{ id: "sandbox-checkout", quantity: 1 }],
          expectedTotalCents: 100,
        },
      });
      created++;
      state = "paid";
      return route.fulfill({
        json: {
          checkoutUrl:
            "https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORDTST01BROWSERTEST",
        },
      });
    }
    if (path === "payments/test/status")
      return route.fulfill({
        json: {
          state,
          testMode: true,
          ...(state !== "none" ? { orderId: "ORDTST01BROWSERTEST" } : {}),
        },
      });
    if (path === "payments/diagnostics")
      return route.fulfill({
        json: {
          configured: true,
          environment: "production",
          webhookConfigured: true,
          origin: "https://loja.example",
          lastAttempt: null,
        },
      });
    return route.fulfill({ json: {} });
  });
  await page.route(
    "https://www.mercadopago.com.br/checkout/v1/redirect?**",
    (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<a href="http://127.0.0.1:3217/admin?pagamento_teste=1">Voltar ao painel de teste</a>',
      }),
  );
  await page.goto("/admin?pagamento_teste=1");
  await page
    .getByLabel("E-mail para homologação", { exact: true })
    .fill("teste@example.invalid");
  await page
    .getByRole("button", { name: "Abrir checkout de teste", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Voltar ao painel de teste", exact: true })
    .click();
  await expect(page.locator(".sandbox-result")).toContainText(
    "Teste aprovado pelo Mercado Pago",
  );
  await expect(page.locator(".sandbox-result")).toContainText(
    "não confirma uma venda real",
  );
  expect(created).toBe(1);
  expect(storeCalls).toBe(0);
  expect(await page.evaluate(() => innerWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
});

test("bulk-only catalog and combo ingredients keep the displayed total on a mobile cart", async ({
  page,
}, info) => {
  await page.goto("/produtos?categoria=Combos");
  await page
    .getByRole("button", { name: "Só essenciais", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Combo energia natural", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("O que vem no combo", { exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".combo-ingredients li")).toHaveCount(3);
  await expect(dialog.locator(".combo-ingredients")).toContainText(
    "Maca Peruana Pura",
  );
  await expect(dialog.locator(".detail-price")).toContainText("24,00");
  await dialog.getByLabel("Quantidade", { exact: true }).fill("2");
  await expect(dialog.locator(".detail-selection-total")).toContainText(
    "48,00",
  );
  await dialog
    .getByRole("button", { name: "Adicionar ao carrinho", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Fechar janela" }).click();
  await page.goto("/carrinho");
  await expect(page.locator(".cart-item")).toHaveCount(1);
  await expect(page.locator(".cart-item-end")).toContainText("48,00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  if (info.project.name === "mobile-390")
    await page.screenshot({
      path: info.outputPath("combo-celular.png"),
      fullPage: true,
    });
  await page.goto("/produtos?q=Creatina%20Max%20Titanium");
  await expect(page.locator(".product-grid .product-card")).toHaveCount(0);
});

test("admin publishes chosen discounts, shows MPV08 diagnosis and estimates a delivery CEP", async ({
  page,
}, info) => {
  let saves = 0;
  let settings = {
    revision: 0,
    offers: [] as Record<string, unknown>[],
    combos: [
      {
        id: "combo-teste",
        name: "Combo teste",
        description: "Porções separadas",
        active: true,
        discountPercent: 0,
        components: [
          { productId: "prod-1", weight: 100 },
          { productId: "prod-2", weight: 100 },
        ],
      },
    ],
  };
  const products = [
    {
      id: "prod-1",
      nome_produto: "Caju",
      valor_unitario: 120,
      isGranel: true,
      active: true,
      costCents: 8000,
    },
    {
      id: "prod-2",
      nome_produto: "Nozes",
      valor_unitario: 100,
      isGranel: true,
      active: true,
      costCents: 7000,
    },
  ];
  await page.route("**/api/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      "/api/admin/",
      "",
    );
    if (path === "notifications/drain")
      return route.fulfill({ json: { processed: 0 } });
    if (path === "session")
      return route.fulfill({
        json: {
          available: true,
          authenticated: true,
          csrfToken: "fixture-csrf",
          username: "admin",
          mfa: true,
        },
      });
    if (path === "order-alerts")
      return route.fulfill({
        json: {
          cursor: 0,
          events: [],
          counts: { new: 0, packing: 0, ready: 0, outForDelivery: 0 },
        },
      });
    if (path === "dashboard")
      return route.fulfill({
        json: {
          grossCents: 0,
          netRevenueCents: 0,
          profitCents: 0,
          feesCents: 0,
          costsCents: 0,
          expensesCents: 0,
          orders: 0,
          pending: 0,
          missingCosts: 0,
          missingFees: 0,
          missingRefunds: 0,
          missingDeliveryCosts: 0,
          deliveryCostsCents: 0,
          incompletePayments: 0,
          chart: [],
          catalogHealth: {
            total: 2,
            active: 2,
            missingPhotos: 0,
            missingCosts: 0,
          },
          topProducts: [],
        },
      });
    if (path === "merchandising") {
      if (route.request().method() === "PUT") {
        expect(route.request().headers()["x-csrf-token"]).toBe("fixture-csrf");
        settings = {
          ...route.request().postDataJSON(),
          revision: settings.revision + 1,
        };
        saves++;
        return route.fulfill({ json: { settings } });
      }
      return route.fulfill({ json: { settings, products } });
    }
    if (path === "payments/diagnostics")
      return route.fulfill({
        json: {
          configured: true,
          environment: "production",
          webhookConfigured: true,
          origin: "https://loja.example",
          lastAttempt: {
            state: "failed",
            supportCode: "MPV08",
            receivedEnvironment: "test",
            at: Date.now(),
          },
        },
      });
    if (path === "shipping")
      return route.fulfill({
        json: {
          enabled: true,
          originPostalCode: "06754000",
          pricePerKmCents: 300,
          minimumFeeCents: 800,
          baseFeeCents: 0,
          maxDistanceMeters: 10000,
          freeAboveCents: null,
          revision: 1,
        },
      });
    if (path === "shipping/estimate") {
      expect(route.request().postDataJSON()).toEqual({
        postalCode: "06754-100",
        subtotalCents: 10000,
      });
      return route.fulfill({
        json: {
          address: {
            street: "Rua de teste",
            neighborhood: "Centro",
            city: "Taboão da Serra",
            state: "SP",
          },
          distanceMeters: 2600,
          withinArea: true,
          enabled: true,
          feeCents: 800,
          revision: 1,
        },
      });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto("/admin");
  const cookie = page.getByRole("button", {
    name: "Só essenciais",
    exact: true,
  });
  if (await cookie.isVisible()) await cookie.click();
  await page
    .getByRole("button", { name: "Ofertas e combos", exact: true })
    .click();
  await page.getByLabel("Desconto no combo (%)", { exact: true }).fill("10");
  await expect(page.locator(".combo-price-preview")).toContainText("19,80");
  await page
    .getByRole("button", { name: "Publicar alterações", exact: true })
    .click();
  await expect(page.getByText(/Vitrine atualizada/)).toBeVisible();
  expect(saves).toBe(1);
  expect(settings.combos[0].discountPercent).toBe(10);
  await page.getByRole("button", { name: /Ofertas individuais/ }).click();
  await page
    .getByRole("button", { name: "Adicionar oferta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publicar alterações", exact: true })
    .click();
  await expect.poll(() => saves).toBe(2);
  expect(settings.offers[0]).toMatchObject({
    active: false,
    discountPercent: 0,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  if (info.project.name === "mobile-390")
    await page.screenshot({
      path: info.outputPath("painel-ofertas-celular.png"),
      fullPage: true,
    });
  await page.getByRole("button", { name: "Pagamentos", exact: true }).click();
  await expect(page.locator(".payment-diagnostics")).toContainText("MPV08");
  await expect(page.locator(".payment-diagnostics")).toContainText(
    "Credenciais",
  );
  await page
    .getByRole("button", { name: "Frete e entregas", exact: true })
    .click();
  await page
    .getByLabel("CEP de destino para teste", { exact: true })
    .fill("06754-100");
  await page
    .getByRole("button", {
      name: "Consultar endereço e distância",
      exact: true,
    })
    .click();
  await expect(page.locator(".shipping-live-test")).toContainText(
    "Rua de teste",
  );
  await expect(page.locator(".shipping-live-test")).toContainText("8,00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
