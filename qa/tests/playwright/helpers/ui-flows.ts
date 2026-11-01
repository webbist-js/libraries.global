import {
  expect,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test"

import {
  fixturePassword,
  retryAfterMs,
  SIGN_IN_ATTEMPTS,
  sleep,
} from "./access-fixtures"

// Pages compile on first visit to a dev server, and a request may wait out a
// 429, so navigations get a minute.
export const NAVIGATION = { timeout: 60_000 }

/** The username field's visible label, the whole of its accessible name. */
export const USERNAME_LABEL = "Username Required"

/** Next may already have streamed a 200 shell before notFound() resolves.
 * Assert the denied document and robots policy as well as its transport status. */
export async function expectMissingPage(page: Page, response: Response | null) {
  expect([200, 404]).toContain(response?.status())
  await expect(
    page.getByRole("heading", { level: 1, name: /We couldn.t find/ })
  ).toBeVisible(NAVIGATION)
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]').first()
  ).toBeAttached()
}

/**
 * Sets a secret through the input's native value setter, not fill():
 * Playwright titles a fill step with its value and logs it on failure, which
 * would put the secret in the HTML report and the terminal.
 */
export async function setSecretValue(input: Locator, value: string) {
  await input.evaluate((el, v) => {
    const node = el as HTMLInputElement
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(node, v)
    node.dispatchEvent(new Event("input", { bubbles: true }))
  }, value)
}

/**
 * Clicks `submit` and waits for the POST to `path`, retrying after a 429 the
 * way signIn does. Returns the final (non-429) response.
 */
async function submitAndWait(page: Page, submit: Locator, path: string) {
  for (let attempt = 1; attempt <= SIGN_IN_ATTEMPTS; attempt++) {
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === path && r.request().method() === "POST",
      { timeout: 30_000 }
    )
    await submit.click()
    const res = await response
    if (res.status() !== 429) return res
    if (attempt < SIGN_IN_ATTEMPTS)
      await sleep(retryAfterMs(res.headers()["x-retry-after"]))
  }
  throw new Error(`${path} stayed rate-limited`)
}

/**
 * Signs in through the sign-in form with the fixture password. Nothing is
 * typed until the submit is enabled, which the form holds off until React has
 * mounted it. Returns the sign-in response so a caller can assert a refusal.
 */
export async function signInThroughForm(
  page: Page,
  email: string,
  callbackUrl?: string
) {
  await page.goto(
    callbackUrl
      ? `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/auth/signin"
  )
  const submit = page.getByRole("button", { name: "Sign in", exact: true })
  await expect(submit).toBeEnabled(NAVIGATION)
  await page.getByLabel("Email address", { exact: true }).fill(email)
  await setSecretValue(
    page.getByLabel("Password", { exact: true }),
    fixturePassword()
  )

  return submitAndWait(page, submit, "/api/auth/sign-in/email")
}

/**
 * Requests a sign-in link through the sign-in form and returns the callback
 * URLs the form sent, read from the request body (the link itself only goes
 * to the email provider or the server log, neither of which a test can read).
 */
export async function requestMagicLinkThroughForm(
  page: Page,
  email: string,
  callbackUrl: string
): Promise<{ callbackURL: string; errorCallbackURL: string }> {
  await page.goto(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  const send = page.getByRole("button", { name: "Email me a sign-in link" })
  await expect(send).toBeEnabled(NAVIGATION)
  await page.getByLabel("Email address", { exact: true }).fill(email)
  const res = await submitAndWait(page, send, "/api/auth/sign-in/magic-link")
  expect(res.status(), "magic-link request").toBe(200)
  const body = res.request().postDataJSON() as {
    callbackURL?: string
    errorCallbackURL?: string
  }
  expect(body.callbackURL).toBeTruthy()
  expect(body.errorCallbackURL).toBeTruthy()
  await expect(page).toHaveURL(/\/auth\/magic-link-sent/, NAVIGATION)

  return {
    callbackURL: body.callbackURL!,
    errorCallbackURL: body.errorCallbackURL!,
  }
}

/**
 * Follows the sign-in link Better Auth would have emailed, rebuilt from its
 * parts, without the token appearing in the report: page.goto titles its
 * step with the URL, so the navigation runs inside page.evaluate, whose
 * arguments the reporter doesn't show (the same reason setSecretValue exists).
 * Resolves once the browser has left the verify endpoint.
 */
export async function followMagicLink(
  page: Page,
  token: string,
  callbacks: { callbackURL: string; errorCallbackURL: string }
) {
  const params = new URLSearchParams({
    token,
    callbackURL: callbacks.callbackURL,
    errorCallbackURL: callbacks.errorCallbackURL,
  })
  const verifyUrl = `/api/auth/magic-link/verify?${params.toString()}`
  await page.goto("/auth/magic-link-sent")
  await page.evaluate((url) => {
    globalThis.location.assign(url)
  }, verifyUrl)
  await page.waitForURL(
    (url) => !url.pathname.startsWith("/api/auth/magic-link/verify"),
    NAVIGATION
  )
}

export async function sessionUser(page: Page) {
  const res = await page.request.get("/api/auth/get-session")

  return (await res.json())?.user ?? null
}

/**
 * Completes onboarding from its first screen with the minimum required
 * fields, and lands on the new profile.
 */
export async function completeOnboarding(page: Page, username: string) {
  await expect(page).toHaveURL(/\/profile\/onboarding(\?|$)/, NAVIGATION)
  // The primary button stays disabled until the page has hydrated.
  const enterProfile = page.getByRole("button", { name: "Enter your profile" })
  await expect(enterProfile).toBeEnabled(NAVIGATION)

  await expect(
    page.getByLabel("Display name Required", { exact: true })
  ).not.toHaveValue("")
  const usernameInput = page.getByLabel(USERNAME_LABEL, { exact: true })
  await usernameInput.fill(username)
  await expect(page.getByText("Available", { exact: true })).toBeVisible(
    NAVIGATION
  )
  await expect(usernameInput).toHaveAccessibleDescription(/^Available /)
  await page
    .getByRole("combobox", { name: "Pronouns Required", exact: true })
    .click()
  await page
    .getByRole("option", { name: "Prefer not to say", exact: true })
    .click()
  // The radio is visually hidden inside its card, so the card is clicked.
  const affiliation = page.getByRole("radiogroup", { name: "Affiliation" })
  await affiliation.getByText("Reader / enthusiast", { exact: true }).click()
  await expect(
    affiliation.getByRole("radio", { name: /^Reader \/ enthusiast/ })
  ).toBeChecked()
  await enterProfile.click()

  await expect(page).toHaveURL(new RegExp(`/profile/${username}$`), NAVIGATION)
}
