import { test, expect } from "@playwright/test";
import { navigateAdmin } from "./admin-navigation";

test("private CSV import previews cost units, requires a fresh preview and keeps finance usable on mobile", async ({ page }, info) => {
  const csv = "ID;Produto;Custo;Venda\nprod-1;Aveia;8,57;17,00\nprod-2;Castanha;0;99,00";
  let applied = false, previews = 0, productSaved = false;
  const product = { id: "prod-1", nome_produto: "Aveia", categoria: "Cereais", peso_produto: "A granel", isGranel: true,
    valor_unitario: 17, priceCents: 1700, costCents: 8573, active: true, imageSha: null, imagem: "/images/products/prod-1.webp" };
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname.slice("/api/admin/".length);
    let json: unknown;
    if (path === "session") json = { available: true, authenticated: true, username: "admin", csrfToken: "cost-fixture", mfa: true };
    else if (path === "dashboard") json = { orders: 4, pending: 1, grossCents: 10000, netRevenueCents: 10000,
      profitCents: applied ? 4000 : null, expensesCents: 1000, feesCents: 500, costsCents: 4500, refundedCents: 0,
      missingCosts: applied ? 0 : 2, missingFees: 0, missingRefunds: 0, missingDeliveryCosts: 0, deliveryCostsCents: 0,
      chart: [{ day: 20782, cents: 10000 }], topProducts: [], catalogHealth: { total: 2, active: 2, missingCosts: applied ? 0 : 2, missingPhotos: 0 },
      today: { orders: 4, paidOrders: 3, grossCents: 10000, pending: 1 }, averageTicketCents: 3333 };
    else if (path === "orders") json = { orders: [] };
    else if (path === "order-alerts") json = { cursor: 0, events: [], counts: {}, hasMore: false };
    else if (path === "notifications/drain") json = { processed: 0 };
    else if (path === "products") json = { products: [product] };
    else if (path === "products/prod-1") {
      const body = request.postDataJSON();
      expect(body.costUnit).toBe("kg"); expect(body.costCents).toBe(8573);
      expect(body.priceUnit).toBe("100g"); expect(body.priceCents).toBe(170);
      expect(request.headers()["x-csrf-token"]).toBe("cost-fixture");
      product.nome_produto = body.name; productSaved = true; json = { ok: true };
    }
    else if (path === "costs/preview") {
      previews++;
      expect(request.method()).toBe("POST"); expect(request.headers()["x-csrf-token"]).toBe("cost-fixture");
      const body = request.postDataJSON(); expect(Buffer.from(body.fileBase64, "base64").toString()).toBe(csv);
      const per100g = body.options.bulkCostUnit === "100g";
      json = { columns: ["ID", "Produto", "Custo", "Venda"].map((label, index) => ({ label, index })),
        options: { costColumn: 2, nameColumn: 1, idColumn: 0, codeColumn: null, bulkCostUnit: per100g ? "100g" : "kg", mode: "missing" },
        sourceSha: "f".repeat(64), fingerprint: per100g ? "updated-preview" : "first-preview", rows: 2,
        entries: [{ id: "prod-1", name: "Aveia", isBulk: true, beforeCostCents: null, costCents: per100g ? 8570 : 857, line: 2 },
          { id: "prod-2", name: "Castanha", isBulk: true, beforeCostCents: null, costCents: 0, line: 3 }],
        alreadyKnown: 0, sameCost: 0, issues: [] };
    } else if (path === "costs/apply") {
      const body = request.postDataJSON();
      expect(request.headers()["x-csrf-token"]).toBe("cost-fixture");
      expect(body.fingerprint).toBe("updated-preview"); expect(body.options.bulkCostUnit).toBe("100g");
      expect(previews).toBe(2); applied = true; json = { updated: 2, skipped: 0 };
    } else throw Error("Unexpected fixture path: " + path);
    await route.fulfill({ json });
  });
  await page.goto("/admin");
  const cookie = page.getByRole("button", { name: "Só essenciais", exact: true });
  if (await cookie.isVisible().catch(() => false)) await cookie.click();
  await navigateAdmin(page, "Custos e importação");
  await page.getByLabel("Arquivo CSV de custos").setInputFiles({ name: "custos-fixture.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  const apply = page.getByRole("button", { name: "Aplicar custos a 2 produtos" });
  await expect(apply).toBeEnabled();
  await expect(page.locator(".admin-table")).toContainText("R$ 8,57");
  await page.getByLabel("Os custos a granel do CSV estão por").selectOption("100g");
  await expect(apply).toBeDisabled();
  await page.getByRole("button", { name: "Conferir arquivo", exact: true }).click();
  await expect(page.locator(".admin-table")).toContainText("R$ 85,70");
  await expect(page.locator(".admin-table")).toContainText("R$ 0,00");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  if (info.project.name === "mobile-390" || info.project.name === "desktop")
    await page.screenshot({ path: info.outputPath("importacao-custos.png"), fullPage: true });
  await apply.click();
  await expect(page.getByRole("status")).toContainText("2 produtos atualizados");
  await navigateAdmin(page, "Financeiro");
  await expect(page.locator(".admin-metrics")).toContainText("R$ 40,00");
  await expect(page.getByRole("heading", { name: "Composição do resultado" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  if (info.project.name === "mobile-390" || info.project.name === "desktop")
    await page.screenshot({ path: info.outputPath("financeiro.png"), fullPage: true });
  await navigateAdmin(page, "Produtos e fotos");
  await page.getByRole("button", { name: "Editar Aveia", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Editar produto" });
  await expect(editor.getByLabel("Custo (R$ / kg, opcional)")).toHaveValue("85.73");
  await editor.getByLabel("Nome", { exact: true }).fill("Aveia da loja");
  await editor.getByRole("button", { name: "Salvar produto", exact: true }).click();
  await expect.poll(() => productSaved).toBe(true);
  await expect(page.locator(".admin-product-table")).toContainText("Aveia da loja");
});
