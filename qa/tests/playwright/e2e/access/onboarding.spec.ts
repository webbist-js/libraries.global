import { expect, type Locator, type Page, test } from "@playwright/test"

import {
  emailFor,
  fixturePassword,
  retryAfterMs,
  SIGN_IN_ATTEMPTS,
  signIn,
  sleep,
} from "../../helpers/access-fixtures"

// Local only, opt-in (the access project). Run it after `pnpm seed:access`,
// which clears this fixture's username on every run: the test onboards it,
// so it passes once per seed. It signs in 3 times (the check below, then
// twice through the form), sharing Better Auth's 5-per-minute limit with
// role-matrix.spec.ts, which notes the project's expected runtime.

const KEY = "onboarding"

/** The username field's visible label, the whole of its accessible name. */
const USERNAME_LABEL = "Username * → libraries.global/@handle"

// Pages compile on first visit to a dev server, and a sign-in may wait out
// a 429 twice, so navigations get a minute and the test five.
const NAVIGATION = { timeout: 60_000 }
test.describe.configure({ mode: "serial", timeout: 300_000 })

test.beforeAll(async ({ playwright }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL!
  const api = await playwright.request.newContext({ baseURL })
  try {
    const res = await signIn(api, baseURL, KEY)
    if (!res.ok())
      throw new Error(
        `Sign-in for ${emailFor(KEY)} failed (${res.status()}). Run \`pnpm seed:access\`.`
      )
    const { user } = await (await api.get("/api/auth/get-session")).json()
    if (user?.profileLoaded !== true)
      throw new Error(
        `The session profile for ${emailFor(KEY)} didn't load. Is Strapi running?`
      )
    if (user.username)
      throw new Error(
        `${emailFor(KEY)} has already onboarded (username "${user.username}"). ` +
          "Run `pnpm seed:access` to reset it, then run this spec again."
      )
  } finally {
    await api.dispose()
  }
})

/** True once React has hydrated the element (it attaches its props then). */
function hydrated(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) =>
    Object.keys(el).some((k) => k.startsWith("__reactProps$"))
  )
}

/**
 * Signs in through the sign-in form. A 429 only shows a toast, so it's
 * waited out and the form submitted again, the way signIn retries.
 *
 * The password is set through the input's native value setter, not fill():
 * Playwright titles a fill step with its value and logs it on failure, which
 * would put the password in the HTML report and the terminal. Nothing is
 * submitted before React hydrates the form, either: a native submit is a GET
 * that would put the password in the URL.
 */
async function signInThroughForm(page: Page, key: string) {
  await page.goto("/auth/signin")
  const password = page.getByLabel("Password", { exact: true })
  await expect.poll(() => hydrated(password), NAVIGATION).toBe(true)
  await page.getByLabel("Email address", { exact: true }).fill(emailFor(key))
  await password.evaluate((el, value) => {
    const input = el as HTMLInputElement
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  }, fixturePassword())

  for (let attempt = 1; attempt <= SIGN_IN_ATTEMPTS; attempt++) {
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/auth/sign-in/email" &&
        r.request().method() === "POST",
      { timeout: 30_000 }
    )
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    const res = await response
    if (res.status() !== 429) {
      expect(res.status(), `sign-in for ${key}`).toBe(200)

      return
    }
    if (attempt < SIGN_IN_ATTEMPTS)
      await sleep(retryAfterMs(res.headers()["x-retry-after"]))
  }
  throw new Error(`sign-in for ${key} stayed rate-limited`)
}

async function sessionUser(page: Page) {
  const res = await page.request.get("/api/auth/get-session")

  return (await res.json())?.user ?? null
}

test("a new user onboards, lands on their profile and stays onboarded", async ({
  page,
}) => {
  const username = `access_onboarded_${Date.now() % 1e6}`

  // A loaded profile with no username signs in to onboarding.
  await signInThroughForm(page, KEY)
  await expect(page).toHaveURL(/\/profile\/onboarding(\?|$)/, NAVIGATION)

  // The required fields, found by their visible labels, which proves each
  // label is tied to its field. The display name is prefilled from the
  // account name. The username is checked for availability as it's typed,
  // and the status is the field's description, not part of its name.
  await expect(
    page.getByLabel("Display name *", { exact: true })
  ).not.toHaveValue("")
  const usernameInput = page.getByLabel(USERNAME_LABEL, { exact: true })
  await expect.poll(() => hydrated(usernameInput), NAVIGATION).toBe(true)
  await usernameInput.fill(username)
  await expect(page.getByText("Available ✓")).toBeVisible()
  await expect(usernameInput).toHaveAccessibleDescription("Available ✓")
  await page
    .getByLabel("Pronouns *", { exact: true })
    .selectOption({ label: "Prefer not to say" })
  const reader = page
    .getByRole("group", { name: "Affiliation" })
    .getByRole("button", { name: "Reader / enthusiast" })
  await reader.click()
  await expect(reader).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Enter your profile" }).click()

  await expect(page).toHaveURL(new RegExp(`/profile/${username}$`), NAVIGATION)

  // The same browser context's session now carries the username.
  const user = await sessionUser(page)
  expect(user?.profileLoaded).toBe(true)
  expect(user?.username).toBe(username)

  // Sign out through the page the header menu's "Sign out" opens (it goes
  // home when done), then sign back in: with a username, sign-in no longer
  // goes to onboarding.
  await page.goto("/auth/signout")
  await page.waitForURL((url) => url.pathname === "/", NAVIGATION)
  await expect.poll(() => sessionUser(page)).toBeNull()
  await signInThroughForm(page, KEY)
  await expect(page).not.toHaveURL(/\/auth\/signin/, NAVIGATION)
  await expect(page).not.toHaveURL(/\/profile\/onboarding/)
})
