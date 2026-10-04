import { expect, test } from "@playwright/test"

import { emailFor } from "../../helpers/access-fixtures"
import { latestMagicLinkToken } from "../../helpers/auth-db"
import {
  followMagicLink,
  NAVIGATION,
  requestMagicLinkThroughForm,
  sessionUser,
} from "../../helpers/ui-flows"

// Local only, opt-in (the access project), after `pnpm seed:access`. Better
// Auth allows 3 magic-link requests a minute per IP; this file makes 2. The
// link is rebuilt from the token in the local Better Auth database plus the
// callbacks the form sent, because no test can read the email.
//
// The `magic-link` fixture never onboards here, so it stays un-onboarded
// between seeds; the `reader` fixture is already onboarded.

test.describe.configure({ mode: "serial", timeout: 300_000 })

const DESTINATION = "/libraries?view=list&sort=name"

test("a first magic-link sign-in lands on onboarding, keeping its destination", async ({
  page,
}) => {
  const email = emailFor("magic-link")
  const callbacks = await requestMagicLinkThroughForm(page, email, DESTINATION)

  // The form routes through post-signin, never straight to the destination.
  expect(callbacks.callbackURL).toBe(
    "/auth/post-signin?next=%252Flibraries%253Fview%253Dlist%2526sort%253Dname"
  )
  expect(callbacks.errorCallbackURL).toBe("/auth/magic-link")

  const token = await latestMagicLinkToken(email)
  await followMagicLink(page, token, callbacks)

  await expect(page).toHaveURL(
    "/profile/onboarding?next=%2Flibraries%3Fview%3Dlist%26sort%3Dname",
    NAVIGATION
  )
  const user = await sessionUser(page)
  expect(user?.email).toBe(email)
  expect(user?.profileLoaded).toBe(true)
  expect(user?.username).toBeNull()
})

test("an onboarded user's magic link lands on the destination", async ({
  page,
}) => {
  const email = emailFor("reader")
  const callbacks = await requestMagicLinkThroughForm(page, email, "/pro")
  const token = await latestMagicLinkToken(email)
  await followMagicLink(page, token, callbacks)

  await expect(page).toHaveURL(/\/pro$/, NAVIGATION)
  const user = await sessionUser(page)
  expect(user?.email).toBe(email)
  expect(user?.username).toBe("access_reader")
})

test("a bad token shows the magic-link error page, signed out", async ({
  page,
}) => {
  await followMagicLink(page, "not-a-real-token", {
    callbackURL: "/auth/post-signin",
    errorCallbackURL: "/auth/magic-link",
  })

  await expect(page).toHaveURL(
    /\/auth\/magic-link\?error=INVALID_TOKEN$/,
    NAVIGATION
  )
  await expect(
    page.getByRole("heading", { name: /That link didn.t work/ })
  ).toBeVisible()
  await expect(
    page.getByText(
      "It may have been used already: each sign-in link works once.",
      {
        exact: false,
      }
    )
  ).toBeVisible()
  // The page offers a new link rather than leaving the reader stuck.
  await expect(
    page.getByRole("button", { name: "Email me a new link" })
  ).toBeVisible()
  expect(await sessionUser(page)).toBeNull()
})
