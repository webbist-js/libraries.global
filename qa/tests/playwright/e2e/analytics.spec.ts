import { expect, test, type Page } from "@playwright/test"

// Explicit operator acceptance only. Fresh anonymous contexts never reuse owner sessions.
test.use({ trace: "off", video: "off" })
test.skip(
  process.env.ANALYTICS_ACCEPTANCE !== "1" ||
    process.env.BASE_URL !== "https://libraries.global",
  "Run explicitly against the released canonical beta after GTM publication."
)

const google =
  /https:\/\/[^/]*(?:googletagmanager\.com|google-analytics\.com|analytics\.google\.com)\//
const collect =
  /https:\/\/[^/]*(?:google-analytics\.com|analytics\.google\.com)\/(?:g\/collect|collect)/
const sentinel = "ANALYTICS_PRIVATE_QUERY_SENTINEL"

async function observe(page: Page) {
  const requests: string[] = []
  const hits: URLSearchParams[] = []
  page.on("request", (request) => {
    if (google.test(request.url())) requests.push(request.url())
  })
  // Verify real SDK output without recording automated test visits in GA.
  await page.route(collect, async (route) => {
    const request = route.request()
    const raw = request.url() + "\n" + (request.postData() ?? "")
    expect(raw).not.toContain(sentinel)
    const parameters = new URL(request.url()).searchParams
    for (const [key, value] of new URLSearchParams(request.postData() ?? ""))
      parameters.set(key, value)
    hits.push(parameters)
    await route.fulfill({ status: 204, body: "" })
  })

  return { requests, hits }
}

test("refusal persists and sends no Google request", async ({
  page,
  context,
}) => {
  const { requests } = await observe(page)
  await page.goto(`/beta?analytics_test=${sentinel}`)
  await expect(
    page.getByRole("button", { name: "Reject analytics", exact: true })
  ).toBeVisible()
  expect(requests).toEqual([])
  await page
    .getByRole("button", { name: "Reject analytics", exact: true })
    .click()
  await page.reload()
  await expect(
    page.getByRole("button", { name: "Cookie choices", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("region", { name: "Your cookie choices" })
  ).toHaveCount(0)
  expect(requests).toEqual([])
  expect(
    (await context.cookies()).filter((cookie) =>
      /^_ga(?:_|$)/.test(cookie.name)
    )
  ).toEqual([])
})

test("one consented view uses GTM, strips queries, and withdrawal unloads collection", async ({
  page,
  context,
}) => {
  const { requests, hits } = await observe(page)
  await page.goto(`/beta?analytics_test=${sentinel}#${sentinel}`)
  await page
    .getByRole("button", { name: "Accept analytics", exact: true })
    .click()
  const views = () => hits.filter((hit) => hit.get("en") === "page_view")
  await expect.poll(() => views().length, { timeout: 20_000 }).toBe(1)
  expect(views()[0]?.get("tid")).toBe("G-8M465CHXJ6")
  expect(views()[0]?.get("dl")).toBe("https://libraries.global/beta")
  expect(views()[0]?.get("dt")).toBe("beta")
  expect(
    requests.filter((url) => url.includes("/gtm.js?id=GTM-M8GLG9F2"))
  ).toHaveLength(1)
  const cookies = (await context.cookies()).filter((cookie) =>
    /^_ga(?:_|$)/.test(cookie.name)
  )
  expect(cookies.length).toBeGreaterThan(0)
  for (const cookie of cookies)
    expect(cookie.expires).toBeLessThanOrEqual(
      Date.now() / 1000 + 180 * 86400 + 60
    )
  await page
    .getByRole("button", { name: "Cookie choices", exact: true })
    .click()
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "Reject analytics", exact: true }).click(),
  ])
  await expect(
    page.getByRole("button", { name: "Cookie choices", exact: true })
  ).toBeVisible()
  const afterReload = requests.length
  await page.goto("/fr/beta")
  await expect(
    page.getByRole("button", { name: "Choix des cookies", exact: true })
  ).toBeVisible()
  expect(requests).toHaveLength(afterReload)
  expect(
    (await context.cookies()).filter((cookie) =>
      /^_ga(?:_|$)/.test(cookie.name)
    )
  ).toEqual([])
})
