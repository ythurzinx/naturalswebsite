import { expect, type Page } from "@playwright/test";

export async function navigateAdmin(page: Page, area: string) {
  await expect(page.getByRole("button", { name: "Atualizar painel", exact: true })).toBeVisible();
  const menu = page.getByRole("button", { name: "Abrir menu do painel", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "Painel administrativo" })
    .getByRole("button", { name: area, exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Áreas do painel" })).toHaveCount(0);
}
