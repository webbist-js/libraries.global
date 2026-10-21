import { expect, type Page } from "@playwright/test"

/** Do not audit or baseline a Suspense/loading shell by accident. */
export async function publicPageReady(page: Page) {
  await expect(page.getByRole("main")).toHaveCount(1)
  await expect(
    page.locator('main[aria-busy="true"], main [aria-busy="true"]')
  ).toHaveCount(0, { timeout: 30_000 })
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
