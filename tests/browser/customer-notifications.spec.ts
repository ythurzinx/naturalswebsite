import { test, expect } from "@playwright/test";

test("admin configures transactional channels without exposing credentials and fits mobile", async ({
  page,
}) => {
  let writes = 0;
  let settings = {
    revision: 0,
    emailEnabled: false,
    whatsappEnabled: false,
    whatsappTemplates: {
      paid: null as number | null,
      ready: null as number | null,
      out_for_delivery: null as number | null,
    },
  };
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
        csrfToken: "admin-fixture",
        mfa: true,
      };
    else if (path === "dashboard")
      json = {
        orders: 0,
        pending: 0,
        grossCents: 0,
        profitCents: null,
        chart: [],
        catalogHealth: {
          total: 0,
          active: 0,
          missingPhotos: 0,
          missingCosts: 0,
        },
        topProducts: [],
      };
    else if (path === "order-alerts")
      json = {
        cursor: 0,
        events: [],
        counts: { toPack: 0, ready: 0, pending: 0 },
        hasMore: false,
      };
    else if (path === "products") json = { products: [] };
    else if (path === "orders") json = { orders: [] };
    else if (path === "expenses") json = { expenses: [] };
    else if (path === "notifications/drain") json = { processed: 0 };
    else if (path === "notifications") {
      if (route.request().method() === "PUT") {
        expect(route.request().headers()["x-csrf-token"]).toBe("admin-fixture");
        const body = route.request().postDataJSON();
        expect(body).toEqual({
          revision: 0,
          emailEnabled: true,
          whatsappEnabled: true,
          whatsappTemplates: { paid: 101, ready: 102, out_for_delivery: 103 },
        });
        settings = { ...body, revision: 1 };
        writes++;
      }
      json = {
        settings,
        readiness: { apiKey: true, email: true, whatsapp: true },
        queue: { pending: 0, issues: 0 },
      };
    } else throw Error("Unexpected API path: " + path);
    await route.fulfill({ json });
  });
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Painel administrativo" })
    .getByRole("button", { name: "Mensagens aos clientes" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Mensagens aos clientes",
      level: 2,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Enviar atualizações por e-mail"),
  ).not.toBeChecked();
  await page.getByLabel("ID do modelo: Pagamento aprovado").fill("101");
  await page.getByLabel("ID do modelo: Pedido separado").fill("102");
  await page.getByLabel("ID do modelo: Saiu para entrega").fill("103");
  await page.getByLabel("Enviar atualizações por e-mail").check();
  await page.getByLabel("Enviar atualizações pelo WhatsApp").check();
  await page
    .getByRole("button", { name: "Salvar canais de atendimento" })
    .click();
  await expect.poll(() => writes).toBe(1);
  await expect(page.getByText(/Configuração salva/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
