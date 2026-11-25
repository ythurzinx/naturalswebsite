import { test, expect } from "@playwright/test";

test("customers follow the preparation steps and the arrival estimate after paying", async ({
  page,
}, info) => {
  let stage = "packing";
  await page.route("**/api/orders/**", (route) =>
    route.fulfill({
      json: {
        orderId: "ORD01TRACKINGFIXTURE",
        state: "paid",
        totalCents: 4280,
        fulfillment: "delivery",
        stage,
        etaMinutes: stage === "out_for_delivery" ? 25 : null,
        testMode: false,
      },
    }),
  );
  await page.goto("/pagamento/retorno?order_id=ORD01TRACKINGFIXTURE");
  const cookie = page.getByRole("button", { name: "Só essenciais", exact: true });
  if (await cookie.isVisible().catch(() => false)) await cookie.click();
  const timeline = page.getByRole("list", { name: "Etapas do pedido" });
  await expect(timeline.locator("li")).toHaveCount(5);
  await expect(timeline.locator("li.done")).toHaveCount(1);
  await expect(timeline.locator('li[aria-current="step"]')).toContainText(
    "Em separação",
  );
  stage = "out_for_delivery";
  await page.getByRole("button", { name: "Atualizar status" }).click();
  await expect(timeline.locator('li[aria-current="step"]')).toContainText(
    "Saiu para entrega",
  );
  await expect(timeline).toContainText(
    "Previsão de chegada: cerca de 25 minutos",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  if (info.project.name === "mobile-390")
    await page.screenshot({ path: info.outputPath("acompanhamento.png") });
});
