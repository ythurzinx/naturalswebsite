import { test, expect, type Page } from "@playwright/test";

async function essentials(page: Page) {
  const button = page.getByRole("button", {
    name: "Só essenciais",
    exact: true,
  });
  await button.waitFor({ state: "visible", timeout: 5000 });
  await button.click();
}
async function fitsScreen(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

test("store navigation fits the viewport and has usable mobile targets", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await essentials(page);
  await expect(page.locator("h1")).toBeVisible();
  await expect(
    page.getByText("por 100 g", { exact: true }).first(),
  ).toBeVisible();
  await fitsScreen(page);
  if (info.project.name.startsWith("mobile")) {
    const nav = page.getByRole("navigation", { name: "Navegação do celular" });
    await expect(nav).toBeVisible();
    for (const link of await nav.getByRole("link").all())
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(errors).toEqual([]);
  if (info.project.name === "mobile-390")
    await page.screenshot({
      path: info.outputPath("loja-celular.png"),
      fullPage: true,
    });
});

test("100 g selection, cart editing and checkout preserve totals on a payment failure", async ({
  page,
}, info) => {
  let checkoutCalls = 0;
  await page.route("**/api/checkout/session", (route) =>
    route.fulfill({
      json: {
        available: true,
        csrfToken: "browser-fixture-csrf",
        testMode: true,
      },
    }),
  );
  await page.route("**/api/checkout", async (route) => {
    checkoutCalls++;
    const body = route.request().postDataJSON();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ weight: 400, quantity: 2 });
    expect(body.expectedTotalCents).toBe(9600);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 502,
      json: { error: "Pagamento de teste indisponível.", supportCode: "MPV08" },
    });
  });
  await page.goto("/produtos?q=Castanha%20de%20Caju%20Crua");
  await essentials(page);
  await page
    .getByRole("button", { name: "Castanha de Caju Crua", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const plus = dialog.getByRole("button", {
    name: "Aumentar 100 g de Castanha de Caju Crua",
    exact: true,
  });
  expect((await plus.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await plus.click();
  await plus.click();
  await dialog.getByLabel("Quantidade de porções").fill("2");
  await expect(dialog.locator(".detail-selection-total")).toContainText(
    "72,00",
  );
  await dialog
    .getByRole("button", { name: "Adicionar ao carrinho", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Fechar janela" }).click();
  if (info.project.name.startsWith("mobile"))
    await page
      .locator(".mobile-bottom-nav")
      .getByRole("link", { name: /Carrinho/ })
      .click();
  else await page.getByRole("link", { name: /Meu carrinho, / }).click();
  await expect(page.locator(".cart-item")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Aumentar 100 g de Castanha de Caju Crua",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Peso de Castanha de Caju Crua", { exact: true }),
  ).toHaveValue("400");
  await expect(page.locator(".cart-item-end")).toContainText("96,00");
  await fitsScreen(page);
  if (info.project.name === "mobile-390")
    await page.screenshot({
      path: info.outputPath("carrinho-celular.png"),
      fullPage: true,
    });
  if (info.project.name.startsWith("mobile"))
    await page
      .locator(".mobile-purchase-bar")
      .getByRole("link", { name: /Continuar/ })
      .click();
  else
    await page
      .getByRole("link", { name: /Continuar com minha seleção/ })
      .click();
  await page.getByLabel("Seu nome", { exact: true }).fill("Ana Teste");
  await page
    .getByLabel("E-mail para o pagamento", { exact: true })
    .fill("ana@example.com");
  const pay = info.project.name.startsWith("mobile")
    ? page.getByRole("button", { name: "Pagar agora", exact: true })
    : page.getByRole("button", { name: /Pagar .* com Mercado Pago/ });
  await pay.dblclick();
  await expect(page.locator(".payment-error[role=alert]")).toContainText(
    "Pagamento de teste indisponível.",
  );
  await expect(page.locator(".payment-error[role=alert]")).toContainText(
    "Código de suporte: MPV08",
  );
  expect(checkoutCalls).toBe(1);
  await fitsScreen(page);
  await page.goto("/carrinho");
  await expect(
    page.getByLabel("Peso de Castanha de Caju Crua", { exact: true }),
  ).toHaveValue("400");
  await expect(page.locator(".cart-item-end")).toContainText("96,00");
});

test("admin stays closed when the server has no configuration", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByText("O acesso administrativo está indisponível.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Entrar no painel" }),
  ).toHaveCount(0);
  expect((await page.request.get("/api/admin/products")).status()).toBe(503);
  await fitsScreen(page);
});

test("admin product batches and order filters work with isolated UI fixtures", async ({
  page,
}, info) => {
  const products = [
    {
      id: "prod-1",
      nome_produto: "Castanha teste",
      categoria: "Castanhas",
      peso_produto: "100 g",
      valor_unitario: 120,
      isGranel: true,
      priceCents: 12000,
      costCents: 8000,
      active: true,
      imageSha: null,
    },
    {
      id: "prod-2",
      nome_produto: "Pasta teste",
      categoria: "Mercearia",
      peso_produto: "500 g",
      valor_unitario: 20,
      isGranel: false,
      priceCents: 2000,
      costCents: null,
      active: true,
      imageSha: "a".repeat(64),
    },
  ];
  const orders = [
    {
      id: "ORD01BROWSERFIXTUREA",
      customer_name: "Ana Teste",
      customer_email: "ana@example.com",
      total_cents: 3600,
      paid_cents: 3600,
      state: "paid",
      fulfillment_status: "ready",
      created_at: Date.now(),
      items: [],
    },
    {
      id: "ORD01BROWSERFIXTUREB",
      customer_name: "Carlos Teste",
      customer_email: "carlos@example.com",
      total_cents: 2000,
      paid_cents: 0,
      state: "pending",
      fulfillment_status: "new",
      created_at: Date.now(),
      items: [],
    },
  ];
  let batches = 0,
    syncs = 0;
  await page.route("**/api/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname.slice(
      "/api/admin/".length,
    );
    let json: unknown = {};
    if (path === "session")
      json = {
        available: true,
        authenticated: true,
        username: "admin",
        csrfToken: "ui-fixture",
        mfa: true,
      };
    else if (path === "dashboard")
      json = {
        orders: 2,
        pending: 1,
        grossCents: 3600,
        netRevenueCents: 3600,
        profitCents: null,
        expensesCents: 0,
        missingCosts: 1,
        missingFees: 1,
        missingRefunds: 0,
        chart: [],
        catalogHealth: {
          total: 2,
          active: 2,
          missingPhotos: 1,
          missingCosts: 1,
        },
        topProducts: [],
      };
    else if (path === "order-alerts")
      json = {
        cursor: 0,
        events: [],
        counts: { toPack: 0, ready: 1, pending: 1 },
        hasMore: false,
      };
    else if (path === "products") json = { products };
    else if (path === "products/availability") {
      expect(route.request().method()).toBe("PATCH");
      expect(route.request().headers()["x-csrf-token"]).toBe("ui-fixture");
      const body = route.request().postDataJSON();
      expect(body).toEqual({ ids: ["prod-1"], active: false });
      products[0].active = false;
      batches++;
      json = { updated: 1 };
    } else if (path === "orders") json = { orders };
    else if (path === `orders/${orders[0].id}`) json = { order: orders[0] };
    else if (path === `orders/${orders[0].id}/sync`) {
      syncs++;
      json = { order: orders[0] };
    } else throw new Error("Unexpected fixture API path: " + path);
    await route.fulfill({ json });
  });
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Painel administrativo" });
  await nav.getByRole("button", { name: "Produtos e fotos" }).click();
  await page.getByLabel("Mostrar produtos").selectOption("photos");
  await expect(page.locator(".admin-product-table tbody tr")).toHaveCount(1);
  await page.getByLabel("Selecionar Castanha teste", { exact: true }).check();
  await page
    .getByRole("button", { name: "Indisponibilizar selecionados" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar alteração" })
    .click();
  await expect(
    page.getByText("Disponibilidade atualizada e registrada no histórico."),
  ).toBeVisible();
  expect(batches).toBe(1);
  await expect(page.locator(".admin-product-table")).toContainText(
    "Indisponível",
  );
  await fitsScreen(page);
  if (info.project.name === "mobile-390")
    await page.screenshot({
      path: info.outputPath("admin-celular.png"),
      fullPage: true,
    });
  await nav.getByRole("button", { name: "Pedidos", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Situação do pedido", exact: true })
    .selectOption("pending");
  await expect(page.locator(".admin-order-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".admin-order-table")).toContainText(
    "Carlos Teste",
  );
  await page
    .getByRole("combobox", { name: "Situação do pedido", exact: true })
    .selectOption("all");
  await page.getByLabel("Buscar pedido", { exact: true }).fill("Ana");
  await expect(page.locator(".admin-order-table tbody tr")).toHaveCount(1);
  await fitsScreen(page);
  await page.getByRole("button", { name: "Ver pedido", exact: true }).click();
  await page
    .getByRole("button", { name: "Consultar pagamento deste pedido" })
    .click();
  await expect.poll(() => syncs).toBe(1);
});
