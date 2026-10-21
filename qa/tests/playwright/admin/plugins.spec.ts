import AxeBuilder from "@axe-core/playwright"
import { expect } from "@playwright/test"

import { test } from "../helpers/admin-test"
import { emptyPluginFixtures } from "../helpers/admin-visual-fixtures"

const plugins = [
  ["discussions", "Discussions"],
  ["events", "Events"],
  ["rewards", "Rewards"],
  ["access", "People"],
  ["content-moderation", "Moderation queue"],
  ["beta-invites", "Beta invites"],
] as const
for (const theme of ["Light mode", "Dark mode"])
  for (const width of [390, 1440])
    test(`${theme}, ${width}px: all bespoke plugins`, async ({ page }) => {
      test.setTimeout(180_000)
      // Set the persisted appearance before entering the narrow layout.
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto("/admin/me")
      await page.getByRole("combobox", { name: "Interface mode" }).click()
      await page.getByRole("option", { name: theme, exact: true }).click()
      await page.getByRole("button", { name: "Save" }).click()
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        theme === "Dark mode" ? "rgb(24, 24, 38)" : "rgb(246, 246, 249)"
      )
      await page.setViewportSize({ width, height: 1000 })
      await emptyPluginFixtures(page)
      for (const [slug, heading] of plugins) {
        await page.goto(`/admin/plugins/${slug}`)
        await expect(
          page.getByRole("heading", { name: heading, exact: true })
        ).toBeVisible()
        await expect(page.getByText(/^Loading\b/)).toHaveCount(0)
        if (slug === "rewards")
          await expect(
            page.getByText(
              "Activity will appear after the first accepted contribution."
            )
          ).toBeVisible()
        await page.evaluate(() => document.fonts.ready)
        await expect(page.getByRole("main")).toHaveCount(1)
        await expect(page.locator("#main-content")).toHaveCount(1)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth)
        ).toBeLessThanOrEqual(width)
        await expect(
          page.getByText(
            "You don't have the permissions to access that content"
          )
        ).toHaveCount(0)
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
        expect(result.violations).toEqual([])
        await expect(page).toHaveScreenshot(
          `${slug}-${theme.toLowerCase().replaceAll(" ", "-")}-${width}.png`,
          { fullPage: true, animations: "disabled" }
        )
      }
    })
test("Access survives a direct load and reload", async ({ page }) => {
  await page.goto("/admin/plugins/access")
  await expect(
    page.getByRole("heading", { name: "People", exact: true })
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "People", exact: true })
  ).toBeVisible()
})
