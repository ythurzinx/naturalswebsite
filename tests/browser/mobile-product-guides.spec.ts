import { test, expect } from "@playwright/test";
import guideData from "../../lib/product-content.json";

test("instant suggestions open a rich product sheet with recipe, weight and a CEP preview", async ({
  page,
}, info) => {
  await page.route("**/api/shipping/session", (r) =>
    r.fulfill({ json: { csrfToken: "shipping-preview-fixture" } }),
  );
  await page.route("**/api/shipping/preview", async (r) => {
    expect(r.request().headers()["x-csrf-token"]).toBe(
      "shipping-preview-fixture",
    );
    expect(r.request().postDataJSON()).toEqual({
      items: [{ id: "prod-125", weight: 200, quantity: 1 }],
      expectedSubtotalCents: 2260,
      postalCode: "06754-100",
    });
    await r.fulfill({
      json: {
        address: {
          street: "Rua do teste",
          neighborhood: "Centro",
          city: "Taboão da Serra",
          state: "SP",
        },
        distanceMeters: 1500,
        withinArea: true,
        enabled: true,
        feeCents: 800,
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Só essenciais", exact: true })
    .click();
  const search = page.getByRole("combobox", {
    name: "Buscar produtos",
    exact: true,
  });
  await search.fill("psy");
  await expect(page.getByRole("listbox")).toContainText("Psyllium Extrato 99%");
  await search.press("ArrowDown");
  await search.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Forma gel em contato com água/)).toBeVisible();
  await dialog.getByRole("tab", { name: "Receita", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Pão de frigideira com psyllium" }),
  ).toBeVisible();
  await expect(dialog.getByText("Ingredientes", { exact: true })).toBeVisible();
  await dialog
    .getByRole("button", {
      name: "Aumentar 100 g de Psyllium Extrato 99%",
      exact: true,
    })
    .click();
  await expect(dialog.locator(".detail-selection-total")).toContainText(
    "22,60",
  );
  await dialog.getByRole("tab", { name: "Entrega", exact: true }).click();
  await dialog.getByLabel("CEP para consultar a entrega").fill("06754-100");
  await dialog
    .getByRole("button", { name: "Consultar frete", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Frete estimado: R$ 8,00",
  );
  await expect(dialog).toContainText("Rua do teste");
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  const purchase = dialog.getByRole("button", {
    name: "Adicionar ao carrinho",
    exact: true,
  });
  await expect(purchase).toBeVisible();
  if (info.project.name.startsWith("mobile")) {
    const box = await purchase.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height + 1,
    );
  }
  if (info.project.name === "mobile-390")
    await page.screenshot({
      path: info.outputPath("produto-no-celular.png"),
      animations: "disabled",
    });
});

test("admin edits information and recipes and moderates a real-review fixture without changing its stars", async ({
  page,
}) => {
  const content = structuredClone(guideData["prod-270"]);
  let revision = 0,
    contentWrites = 0,
    moderationWrites = 0,
    published = false;
  await page.route("**/api/admin/**", async (r) => {
    const path = new URL(r.request().url()).pathname.slice(
      "/api/admin/".length,
    );
    let json: unknown = {};
    if (path === "session")
      json = {
        available: true,
        authenticated: true,
        username: "admin",
        csrfToken: "admin-content-fixture",
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
          total: 1,
          active: 1,
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
    else if (path === "notifications/drain") json = { processed: 0 };
    else if (path === "content-products")
      json = {
        products: [
          {
            id: "prod-270",
            nome_produto: "Castanha de Caju Crua",
            isGranel: true,
          },
        ],
      };
    else if (path === "product-content/prod-270") {
      if (r.request().method() === "PUT") {
        const body = r.request().postDataJSON();
        expect(r.request().headers()["x-csrf-token"]).toBe(
          "admin-content-fixture",
        );
        expect(Object.keys(body).sort()).toEqual(["content", "revision"]);
        expect(body.revision).toBe(0);
        expect(body.content.description).toBe(
          "Castanhas selecionadas para porções e receitas da loja.",
        );
        expect(body.content.recipe.title).toBe("Farofa especial da loja");
        Object.assign(content, body.content);
        revision++;
        contentWrites++;
      }
      json = { content, revision };
    } else if (path === "reviews")
      json = {
        reviews: [
          {
            id: "a".repeat(64),
            orderId: "ORD01REVIEWBROWSER",
            productName: "Castanha de Caju Crua",
            author: "Cliente",
            rating: 2,
            text: "A embalagem pode melhorar, mas gostei do produto.",
            createdAt: Date.now(),
            published,
            reply: "",
          },
        ],
      };
    else if (path === `reviews/${"a".repeat(64)}`) {
      const body = r.request().postDataJSON();
      expect(body).toEqual({
        published: true,
        reply: "Obrigado pelo retorno. Vamos melhorar a embalagem.",
      });
      expect(r.request().headers()["x-csrf-token"]).toBe(
        "admin-content-fixture",
      );
      published = true;
      moderationWrites++;
      json = { ok: true };
    } else throw Error("Unexpected admin route " + path);
    await r.fulfill({ json });
  });
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Painel administrativo" });
  await nav
    .getByRole("button", { name: "Conteúdo e receitas", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Descrição completa", exact: true })
    .fill("Castanhas selecionadas para porções e receitas da loja.");
  await page
    .getByLabel("Nome da receita", { exact: true })
    .fill("Farofa especial da loja");
  await page
    .getByRole("button", {
      name: "Publicar informações e receita",
      exact: true,
    })
    .click();
  await expect.poll(() => contentWrites).toBe(1);
  await expect(
    page.getByText("Informações e receita publicadas na ficha do produto."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await nav.getByRole("button", { name: "Avaliações", exact: true }).click();
  await expect(page.getByLabel("2 de 5 estrelas")).toBeVisible();
  await page
    .getByLabel("Resposta da loja (opcional)")
    .fill("Obrigado pelo retorno. Vamos melhorar a embalagem.");
  await page
    .getByRole("button", { name: "Publicar avaliação", exact: true })
    .click();
  await expect.poll(() => moderationWrites).toBe(1);
  await expect(
    page.getByText(
      "Avaliação publicada. A nota e o texto originais foram preservados.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("2 de 5 estrelas")).toBeVisible();
});

test("review form shows no invented rating, requires publication consent and submits a completed-purchase fixture", async ({
  page,
}) => {
  let submitted = 0;
  await page.route("**/api/reviews?*", (r) =>
    r.fulfill({
      json: { available: true, average: null, count: 0, reviews: [] },
    }),
  );
  await page.route("**/api/reviews", async (r) => {
    if (r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      expect(body).toEqual({
        orderId: "ORD01REVIEWBROWSER",
        productId: "prod-270",
        rating: 5,
        text: "Gostei do sabor, da embalagem e da facilidade para pedir.",
        publishConsent: true,
      });
      expect(r.request().headers()["x-csrf-token"]).toBe("review-fixture");
      submitted++;
      return r.fulfill({
        json: {
          received: true,
          published: false,
          message:
            "Obrigado! Sua avaliação foi recebida e aguarda análise antes da publicação.",
        },
      });
    }
    return r.fulfill({
      json: { available: true, average: null, count: 0, reviews: [] },
    });
  });
  await page.route("**/api/reviews/eligibility", (r) =>
    r.fulfill({
      json: {
        products: [
          {
            orderId: "ORD01REVIEWBROWSER",
            productId: "prod-270",
            title: "Castanha de Caju Crua",
            reviewed: false,
          },
        ],
      },
    }),
  );
  await page.route("**/api/checkout/session", (r) =>
    r.fulfill({ json: { available: true, csrfToken: "review-fixture" } }),
  );
  await page.goto("/avaliacoes");
  await page
    .getByRole("button", { name: "Só essenciais", exact: true })
    .click();
  await expect(
    page.getByText("Seja a primeira pessoa a avaliar"),
  ).toBeVisible();
  await page
    .getByLabel("Produto da sua compra")
    .selectOption("ORD01REVIEWBROWSER|prod-270");
  await page.getByRole("radio", { name: "5 estrelas", exact: true }).check();
  await page
    .getByLabel("Sua avaliação", { exact: false })
    .fill("Gostei do sabor, da embalagem e da facilidade para pedir.");
  const consent = page.getByRole("checkbox", {
    name: "Autorizo publicar minha avaliação e meu primeiro nome na loja.",
  });
  await expect(consent).not.toBeChecked();
  await consent.check();
  await page
    .getByRole("button", { name: "Enviar minha avaliação", exact: true })
    .click();
  await expect.poll(() => submitted).toBe(1);
  await expect(
    page.getByText(
      "Obrigado! Sua avaliação foi recebida e aguarda análise antes da publicação.",
      { exact: true },
    ),
  ).toBeVisible();
});
