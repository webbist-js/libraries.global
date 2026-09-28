import { expect, test } from "@playwright/test"

import { emailFor, signIn } from "../../helpers/access-fixtures"
import {
  completeOnboarding,
  NAVIGATION,
  sessionUser,
  signInThroughForm,
} from "../../helpers/ui-flows"

// Local only, opt-in (the access project). Run it after `pnpm seed:access`,
// which clears this fixture's username on every run: the test onboards it,
// so it passes once per seed. It signs in 3 times (the check below, then
// twice through the form), sharing Better Auth's 5-per-minute limit with
// role-matrix.spec.ts, which notes the project's expected runtime.

const KEY = "onboarding"

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

test("a new user onboards, lands on their profile and stays onboarded", async ({
  page,
}) => {
  const username = `access_onboarded_${Date.now() % 1e6}`

  // A loaded profile with no username signs in to onboarding.
  const first = await signInThroughForm(page, emailFor(KEY))
  expect(first.status()).toBe(200)
  await completeOnboarding(page, username)

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
  const second = await signInThroughForm(page, emailFor(KEY))
  expect(second.status()).toBe(200)
  await expect(page).not.toHaveURL(/\/auth\/signin/, NAVIGATION)
  await expect(page).not.toHaveURL(/\/profile\/onboarding/)
})
