import { expect, test } from "@playwright/test"

test.describe("Community section", () => {
  test("the header links to the Noticeboard and its tabs work", async ({
    page,
  }) => {
    await page.goto("/")
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Community" })
      .click()
    await expect(page).toHaveURL(/\/community$/)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "noticeboard"
    )

    const tabs = page.getByRole("navigation", { name: "Community" })
    await tabs.getByRole("link", { name: /Leaderboard/ }).click()
    await expect(page).toHaveURL(/\/community\/leaderboard$/)
    await expect(
      page.getByRole("navigation", { name: "Leaderboard period" })
    ).toBeVisible()

    await tabs.getByRole("link", { name: /Suggestions/ }).click()
    await expect(page).toHaveURL(/\/community\/suggestions$/)
    await expect(
      page.getByRole("heading", { name: "Vote on additions" })
    ).toBeVisible()
  })

  test("Community pages are indexable", async ({ page }) => {
    await page.goto("/community")
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
      "content",
      /noindex/
    )
  })

  test("the old Contribute leaderboard route is gone", async ({ page }) => {
    const res = await page.goto("/contribute/community")
    expect(res?.status()).toBe(404)
  })
})
