import { navigateAdmin } from "./admin-navigation";
import { test, expect, type Page } from "@playwright/test";
import { readinessFixture } from "./readiness-fixture";

async function fitsScreen(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

test("a coupon discounts the products, not the delivery, and reaches the payment request", async ({
  page,
}, info) => {
  let checkoutCalls = 0;
  await page.addInitScript(() => {
    if (!localStorage.getItem("mundo-natural.cart.v2"))
      localStorage.setItem(
        "mundo-natural.cart.v2",
        JSON.stringify({
          version: 2,
          savedAt: Date.now(),
          items: [{ id: "prod-270", quantity: 1, weight: 300 }],
        }),
      );
  });
  await page.route("**/api/checkout/session", (route) =>
    route.fulfill({
      json: { available: true, csrfToken: "coupon-fixture", testMode: true },
    }),
  );
  await page.route("**/api/checkout/coupon", async (route) => {
    expect(route.request().headers()["x-csrf-token"]).toBe("coupon-fixture");
    const { code } = route.request().postDataJSON();
    if (code !== "INAUGURA10")
      return route.fulfill({
        status: 404,
        json: { error: "Cupom inválido ou fora da validade." },
      });
    return route.fulfill({
      json: {
        coupon: {
          code: "INAUGURA10",
          percent: 10,
          minSubtotalCents: 0,
          endsAt: null,
        },
      },
    });
  });
  await page.route("**/api/checkout", async (route) => {
    checkoutCalls++;
    const body = route.request().postDataJSON();
    expect(body.couponCode).toBe("INAUGURA10");
    // 300 g of Castanha de Caju Crua: R$ 13,40 → R$ 12,00 per 100 g.
    expect(body.expectedTotalCents).toBe(3600);
    await route.fulfill({
      status: 502,
      json: { error: "Pagamento de teste indisponível." },
    });
  });
  await page.goto("/checkout");
  const cookie = page.getByRole("button", { name: "Só essenciais", exact: true });
  await cookie.waitFor({ state: "visible", timeout: 5000 });
  await cookie.click();
  await page.getByLabel("Seu nome", { exact: true }).fill("Ana Teste");
  await page
    .getByLabel("E-mail para o pagamento", { exact: true })
    .fill("ana@example.com");
  await page
    .getByLabel("Telefone para contato", { exact: true })
    .fill("11999999999");
  await expect(page.locator(".summary-total")).toContainText("40,20");
  const field = page.getByLabel("Cupom de desconto (opcional)", {
    exact: true,
  });
  await field.fill("naoexiste");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.locator(".coupon-box [role=alert]")).toContainText(
    "Cupom inválido",
  );
  await field.fill("inaugura10");
  await field.press("Enter");
  await expect(page.locator(".coupon-applied")).toContainText("INAUGURA10");
  await expect(page.locator(".summary-discount")).toContainText("4,20");
  await expect(page.locator(".summary-total")).toContainText("36,00");
  await expect(page.locator(".coupon-savings")).toContainText(
    "não vale para o frete",
  );
  await fitsScreen(page);
  if (info.project.name === "mobile-390") {
    await page.locator(".coupon-box").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("cupom-checkout.png") });
  }
  await page
    .getByRole("button", { name: /Pagar|Pagar agora/ })
    .first()
    .click();
  await expect(page.locator(".payment-error[role=alert]").last()).toContainText(
    "Pagamento de teste indisponível.",
  );
  expect(checkoutCalls).toBe(1);
  await page
    .getByRole("button", { name: "Remover cupom INAUGURA10", exact: true })
    .click();
  await expect(page.locator(".summary-total")).toContainText("40,20");
  await expect(page.locator(".summary-discount")).toHaveCount(0);
});

test("the team creates, pauses and deletes coupons in the admin panel", async ({
  page,
}, info) => {
  type Coupon = Record<string, unknown> & { code: string; active: boolean };
  let coupons: Coupon[] = [];
  const list = () => ({
    revision: 1,
    coupons: coupons.map((c) => ({
      ...c,
      current: c.active,
      usage: { paidUses: 0, paidDiscountCents: 0, pendingUses: 0 },
    })),
  });
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.slice("/api/admin/".length);
    if (request.method() !== "GET")
      expect(request.headers()["x-csrf-token"]).toBe("ui-fixture");
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
    else if (path === "readiness") json = readinessFixture;
    else if (path === "message-templates") json = { templates: {}, revision: 0 };
    else if (path === "orders") json = { orders: [] };
    else if (path === "dashboard")
      json = {
        orders: 0,
        pending: 0,
        grossCents: 0,
        netRevenueCents: 0,
        profitCents: null,
        expensesCents: 0,
        missingCosts: 0,
        missingFees: 0,
        missingRefunds: 0,
        chart: [],
        catalogHealth: { total: 0, active: 0, missingPhotos: 0, missingCosts: 0 },
        topProducts: [],
      };
    else if (path === "order-alerts")
      json = { cursor: 0, events: [], counts: {}, hasMore: false };
    else if (path === "coupons" && request.method() === "GET") json = list();
    else if (path === "coupons" && request.method() === "POST") {
      const body = request.postDataJSON();
      expect(body).toMatchObject({
        code: "INAUGURA10",
        percent: 10,
        minSubtotalCents: 3000,
        maxUses: 200,
        onePerCustomer: true,
        active: true,
      });
      coupons.push({ ...body, createdAt: Date.now() });
      json = list();
    } else if (path === "coupons/INAUGURA10" && request.method() === "PATCH") {
      expect(request.postDataJSON()).toEqual({ active: false });
      coupons[0].active = false;
      json = list();
    } else if (path === "coupons/INAUGURA10" && request.method() === "DELETE") {
      coupons = [];
      json = list();
    } else throw new Error("Unexpected fixture API path: " + path);
    await route.fulfill({ json });
  });
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/admin");
  const cookie = page.getByRole("button", { name: "Só essenciais", exact: true });
  if (await cookie.isVisible()) await cookie.click();
  await navigateAdmin(page, "Cupons");
  await expect(page.getByText("Nenhum cupom cadastrado ainda.")).toBeVisible();
  await page.getByLabel("Código", { exact: true }).fill("inaugura10");
  await page.getByLabel("Desconto (%)", { exact: true }).fill("10");
  await page
    .getByLabel("Compra mínima em produtos (R$, opcional)", { exact: true })
    .fill("30,00");
  await page
    .getByLabel("Limite total de usos (opcional)", { exact: true })
    .fill("200");
  await page.getByLabel("Um uso por e-mail de cliente").check();
  await page.getByRole("button", { name: "Criar cupom" }).click();
  await expect(page.locator(".admin-notice")).toContainText(
    "Cupom INAUGURA10 criado",
  );
  const row = page.locator(".coupon-row");
  await expect(row).toContainText("10% de desconto");
  await expect(row).toContainText("compra mínima de R$ 30,00");
  await expect(row).toContainText("1 uso por e-mail");
  await expect(row).toContainText("Valendo agora");
  if (info.project.name === "mobile-390")
    await page.screenshot({
      path: info.outputPath("cupom-painel.png"),
      fullPage: true,
    });
  await row.getByRole("button", { name: "Desativar" }).click();
  await expect(row).toContainText("Desativado");
  await row.getByRole("button", { name: "Excluir cupom INAUGURA10" }).click();
  await expect(page.locator(".coupon-row")).toHaveCount(0);
  await fitsScreen(page);
});
