import { expect, test as base, type BrowserContext } from "@playwright/test"

import { setSecretValue } from "./ui-flows"

type AdminState = Awaited<ReturnType<BrowserContext["storageState"]>>

/** One native login per worker. State stays in memory; no auth files or traces. */
export const test = base.extend<{}, { adminState: AdminState }>({
  adminState: [
    async ({ browser }, use, workerInfo) => {
      const email = process.env.QA_ADMIN_EMAIL
      const password = process.env.QA_ADMIN_PASSWORD
      if (!email?.endsWith("@example.test") || !password)
        throw new Error("Use a disposable @example.test QA admin")
      const context = await browser.newContext({
        baseURL: workerInfo.project.use.baseURL,
      })
      // Strapi's upstream release badge is outside this plugin baseline.
      await context.route(
        "https://api.github.com/repos/strapi/strapi/releases/latest",
        (route) => route.fulfill({ json: { tag_name: "v0.0.0" } })
      )
      const page = await context.newPage()
      await page.goto("/admin/auth/login")
      await page.getByLabel("Email", { exact: false }).fill(email)
      await setSecretValue(
        page.getByLabel("Password", { exact: false }),
        password
      )
      await page
        .getByRole("checkbox", { name: "Remember me", exact: true })
        .check()
      for (let attempt = 0; attempt < 11; attempt++) {
        const [response] = await Promise.all([
          page.waitForResponse(
            (r) =>
              new URL(r.url()).pathname === "/admin/login" &&
              r.request().method() === "POST"
          ),
          page.getByRole("button", { name: "Login" }).click(),
        ])
        if (response.status() !== 429) {
          expect(response.status()).toBe(200)
          break
        }
        if (attempt === 10)
          throw new Error("Local fixture admin login remained rate limited")
        await page.waitForTimeout(30_000)
      }
      await expect(page).toHaveURL(/\/admin\/?$/)
      const state = await context.storageState()
      await context.close()
      await use(state)
    },
    { scope: "worker", timeout: 360_000 },
  ],
  storageState: async ({ adminState }, provide) => provide(adminState),
})
