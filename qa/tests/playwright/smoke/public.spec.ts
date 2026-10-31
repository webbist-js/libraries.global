import { expect, test } from "@playwright/test"

import urls from "../helpers/urls.json"

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return
  const focus = await page.evaluate(() => ({
    documentFocused: document.hasFocus(),
    mainFocused: document.activeElement === document.getElementById("main"),
    activeTag: document.activeElement?.tagName,
    activeId: document.activeElement?.id,
    dashboardHydrated: document.documentElement.dataset.dashboardActive,
  }))
  await testInfo.attach("public-shell-focus", {
    body: JSON.stringify(focus, null, 2),
    contentType: "application/json",
  })
})

for (const url of urls)
  test(`public shell ${url}`, async ({ page }) => {
    const response = await page.goto(url)
    expect(response?.status()).toBeLessThan(400)
    await expect(page.getByRole("main")).toHaveCount(1)
    await expect(page.locator("#main")).toHaveCount(1)
    await expect(page.getByRole("main").getByRole("banner")).toHaveCount(0)
    const skip = page.locator('a[href="#main"]')
    await skip.focus()
    await skip.press("Enter")
    await expect(page.locator("#main")).toBeFocused()
  })
test("Events stays hydrated and sends search to the server", async ({
  page,
}) => {
  const queries: string[] = []
  await page.route("**/api/search/indexes/event/search", async (route) => {
    const query = route.request().postDataJSON() as {
      q?: string
      page?: number
      hitsPerPage?: number
    }
    queries.push(query.q ?? "")
    await route.fulfill({
      json: {
        hits: [],
        totalHits: 0,
        totalPages: 0,
        page: query.page ?? 1,
        hitsPerPage: query.hitsPerPage ?? 30,
        facetDistribution: {},
      },
    })
  })
  await page.goto("/events")
  await page.getByRole("searchbox", { name: /Search events/ }).fill("archives")
  await expect(page).toHaveURL(/q=archives/)
  await expect.poll(() => queries.includes("archives")).toBe(true)
})
