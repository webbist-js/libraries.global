import path from "node:path"

import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

// Run against an isolated beta-enabled preview. Waitlist writes are intercepted.
// BASE_URL=http://localhost:3010 BETA_E2E_CODE=<single-use local invitation code>
test.skip(!process.env.BETA_E2E_CODE, "Requires a beta-enabled test preview")
test.use({ trace: "off", video: "off" })

const preview = (name: string) =>
  path.resolve(__dirname, "../test-results", `beta-${name}.png`)

test("locks deep links, dotted slugs, exports, feeds and account APIs", async ({
  request,
}) => {
  for (const path of ["/", "/map", "/europe/uk/london/st.johns"]) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status()).toBe(307)
    expect(response.headers().location).toContain("/beta")
  }
  const localized = await request.get("/cs/map", { maxRedirects: 0 })
  expect(localized.headers().location).toContain("/cs/beta")
  for (const path of [
    "/api/export/atlas",
    "/sitemap.xml",
    "/feeds/journal.ics",
    "/api/public-proxy/api/libraries",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status()).toBe(401)
    expect(response.headers()["x-robots-tag"]).toContain("noindex")
  }
  const signUp = await request.post("/api/auth/sign-up/email", { data: {} })
  expect(signUp.status()).toBe(401)
})

test("shows the desktop layout, invite visibility and invalid-invitation state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1682, height: 1472 })
  await page.goto("/beta")
  await expect(
    page.getByRole("heading", { name: "A small room, for now." })
  ).toBeVisible()
  await page.screenshot({
    path: preview("desktop"),
    fullPage: true,
  })
  const password = page.getByLabel("Invite code", { exact: true })
  await password.fill("incorrect-test-password")
  await page.getByRole("button", { name: "Show", exact: true }).click()
  await expect(password).toHaveAttribute("type", "text")
  await page.getByRole("button", { name: "Hide", exact: true }).click()
  await expect(password).toHaveAttribute("type", "password")
  await page.getByRole("button", { name: "Enter", exact: true }).click()
  await expect(page.locator("#beta-password-error")).toContainText(
    "This invitation is invalid"
  )
  await expect(password).toHaveAttribute("aria-invalid", "true")
  await expect(password).toHaveValue("incorrect-test-password")
  const accessibility = await new AxeBuilder({ page })
    .exclude("nextjs-portal")
    .analyze()
  expect(accessibility.violations).toEqual([])
  await page.screenshot({
    path: preview("password-error"),
    fullPage: true,
  })
})

test("shows a waitlist failure and a successful retry without creating an account", async ({
  page,
  context,
}) => {
  let attempts = 0
  await page.route("**/api/beta/waitlist", async (route) => {
    const data = route.request().postDataJSON()
    expect(data).toMatchObject({
      email: "beta-fixture@example.org",
      locale: "en",
    })
    expect(data.type).toBeUndefined()
    await route.fulfill({
      status: ++attempts === 1 ? 502 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        attempts === 1 ? { error: "Unavailable" } : { ok: true }
      ),
    })
  })
  await page.goto("/beta")
  await page
    .getByLabel("Email address", { exact: true })
    .fill("beta-fixture@example.org")
  await page
    .getByRole("button", { name: "Request access", exact: true })
    .click()
  await expect(page.locator("#beta-waitlist-error")).not.toBeEmpty()
  await page
    .getByRole("button", { name: "Request access", exact: true })
    .click()
  await expect(page.getByRole("status")).toContainText(
    "beta-fixture@example.org"
  )
  await expect(page.getByRole("status")).toContainText("You're on the list")
  expect(
    (await context.cookies()).some((cookie) =>
      /better-auth|lg-beta-access/.test(cookie.name)
    )
  ).toBe(false)
  await page.screenshot({
    path: preview("waitlist-success"),
    fullPage: true,
  })
})

test("renders on mobile and in Czech without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/beta")
  await expect(page.getByLabel("Invite code", { exact: true })).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390)
  await page.screenshot({
    path: preview("mobile"),
    fullPage: true,
  })
  const accessibility = await new AxeBuilder({ page })
    .exclude("nextjs-portal")
    .analyze()
  expect(accessibility.violations).toEqual([])
  await page.goto("/cs/beta")
  await expect(page.locator("html")).toHaveAttribute("lang", "cs")
  await expect(
    page.getByRole("heading", { name: "Vstoupit do bety" })
  ).toBeVisible()
})

test("shows success and grants a browser pass without an account session", async ({
  page,
  context,
}) => {
  await page.route(
    (url) => url.pathname === "/beta-test-destination",
    (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>Test destination</h1>",
      })
  )
  await page.goto(
    `/beta?next=/beta-test-destination#invite=${process.env.BETA_E2E_CODE!}`
  )
  await expect(page.getByLabel("Invite code", { exact: true })).toHaveValue(
    process.env.BETA_E2E_CODE!
  )
  expect(
    (await context.cookies()).some((cookie) => cookie.name === "lg-beta-access")
  ).toBe(false)
  await page
    .getByLabel("Invite code", { exact: true })
    .fill(process.env.BETA_E2E_CODE!)
  await page.getByRole("button", { name: "Enter", exact: true }).click()
  await expect(page.getByRole("heading", { name: "You're in." })).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Continue now" })
  ).toHaveAttribute("href", "/beta-test-destination")
  await page.screenshot({
    path: preview("entry-success"),
    fullPage: true,
  })
  const cookies = await context.cookies()
  expect(cookies.some((cookie) => /better-auth/.test(cookie.name))).toBe(false)
  expect(
    cookies.find((cookie) => cookie.name === "lg-beta-access")
  ).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" })
  const allowed = await context.request.get(
    "/api/search/indexes/library/documents"
  )
  expect(allowed.status()).toBe(405)
  await expect(
    page.getByRole("heading", { name: "Test destination" })
  ).toBeVisible()
})
