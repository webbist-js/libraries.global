import { expect, test } from "@playwright/test"

test.use({ trace: "off", video: "off" })
test.beforeEach(async ({ baseURL }) => {
  test.skip(
    !baseURL ||
      !["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname),
    "Local dashboard acceptance only"
  )
})

test("boots the real search endpoint with public results and no shared caching", async ({
  request,
}) => {
  // Do not mock imports or this endpoint: this catches request-config/navigation cycles.
  const response = await request.get("/api/site-search?q=Knowledge&locale=en")
  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toBe("private, no-store")
  const result = await response.json()
  expect(result).toMatchObject({
    items: expect.any(Array),
    counts: expect.any(Object),
    unavailable: expect.any(Array),
  })
  expect(result.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ group: "pages", href: "/knowledge" }),
    ])
  )
  for (const item of result.items)
    expect(Object.keys(item).sort()).toEqual([
      "group",
      "href",
      "id",
      "summary",
      "title",
    ])
})

test("opens search from the toolbar, navigates by keyboard and clears recent terms", async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.goto("/knowledge")
  const trigger = page.locator(".site-search-trigger").first()
  await trigger.click()
  const dialog = page.getByRole("dialog"),
    input = dialog.getByRole("combobox")
  await expect(input).toBeFocused()
  const response = page.waitForResponse(
    (res) =>
      res.url().includes("/api/site-search?") &&
      new URL(res.url()).searchParams.get("q") === "Knowledge"
  )
  await input.fill("Knowledge")
  expect((await response).status()).toBe(200)
  await expect(
    dialog.locator(".site-search-group-pages").getByRole("option").first()
  ).toBeVisible()
  await input.press("ArrowDown")
  await expect(input).toHaveAttribute("aria-activedescendant", /.+/)
  await input.press("Enter")
  await expect(dialog).toHaveCount(0)
  await page.keyboard.press("Control+k")
  await expect(
    dialog
      .locator(".site-search-recents")
      .getByRole("button", { name: "Knowledge", exact: true })
  ).toBeVisible()
  await dialog.getByRole("button", { name: "Clear recent searches" }).click()
  await expect(dialog.locator(".site-search-recents")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
})
