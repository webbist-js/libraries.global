# WP1: Auth and Login, Production-Ready — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every sign-in and sign-up path land new users in onboarding, prove the register → verify → sign in → onboard → delete funnel and the terms gate with E2E, fix the settings form's WCAG A failures, make email delivery configurable for production, settle GitHub OAuth, and hand the owner one manual checklist for what E2E can't cover.

**Architecture:** Better Auth 1.4.18 runs inside Next.js (`apps/ui/src/lib/auth.ts`) on a Postgres pool; Strapi holds the profile through the secret-gated auth-bridge. `/auth/post-signin` is the one place that decides "onboarding or destination", so every path (password, OAuth, magic link, email verification) must end there. E2E runs against the local dev servers with the seeded `access-*@example.test` fixtures, reads magic-link tokens straight from the Better Auth `verification` table and flips `emailVerified` in the `user` table, the way the seed already does.

**Tech Stack:** Next.js 16 App Router, Better Auth 1.4.18 (`magicLink`, `customSession`), pg, nodemailer, vitest + happy-dom + @testing-library/react, Playwright (`--project=access`).

Handoff: `docs/superpowers/handoffs/2026-09-28-pro-auth-contribution-handoff.md` §6 WP1. Specs: `docs/superpowers/specs/2026-04-25-better-auth-migration-design.md` (historical: the Strapi-plugin variant it describes was not adopted; Better Auth lives in Next.js) and `2026-04-26-settings-onboarding-design.md` §4–5.

## Global Constraints

- **Never print secrets.** Never `cat`, `grep`, `head` or Read `apps/ui/.env.local`, `apps/strapi/.env`, `qa/tests/playwright/.env` or `qa/tests/playwright/TEST-USERS.local.md`. Check a key with `node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log(/^KEY=./m.test(s)?"set":"unset")' <file>`. Playwright specs never `fill()` a password (Playwright logs fill values); use the native value setter as `onboarding.spec.ts` does. Never log a token, link or password in a test's output or error message.
- **Shared working tree.** Run `git status --short -- <file>` before editing a file; don't touch files with changes you didn't make. Commit with an explicit pathspec: `git commit -m "<msg>" -- <paths>`. Never `git stash`, `git reset`, `git checkout --`, `git restore` or `--no-verify`.
- **Dev servers belong to the owner.** Never start, stop or restart Strapi (:1337) or the UI (:3000). Report to the controller if they're down.
- **Commits:** conventional, header ≤ 72 characters, lower-case subject, scope = package (`ui`, `strapi`, `access`, `tests-playwright`) or `docs:` with no scope. **No `Co-Authored-By` or any self-credit line.** Stay on `dev`, never push.
- **Node 22:** `source ~/.nvm/nvm.sh && nvm use 22` before any pnpm/npx command.
- **Rate limits (Better Auth, per IP, database-backed, 60 s window):** `/sign-in/email` 5, `/sign-in/magic-link` 3, `/sign-up/email` 3, `/forget-password` 3, `/request-password-reset` 3, `/send-verification-email` 3. Every spec budgets its calls, and every helper waits out a 429 using `retryAfterMs` from `helpers/access-fixtures.ts`.
- **Every redirect target is user-controlled input:** pass it through `safeRedirectPath` (`apps/ui/src/lib/safe-redirect.ts`) before it reaches `location.href`, `redirect()` or a Better Auth `callbackURL`.
- **Onboarding is decided by `/auth/post-signin`:** `profileLoaded === true && !username` means onboarding; a Strapi outage (`profileLoaded: false`) must never bounce a user into onboarding.
- **No account without accepting the current terms:** `TERMS_VERSION` (`apps/ui/src/lib/legal-consent.ts`) is required by the `/sign-up/email` before-hook (400 with "Confirm you're 18 or over and accept the terms to create an account.") and by `databaseHooks.user.create.before` for every path including OAuth.
- **Keep** the pre-hijack guard in `databaseHooks.account.create.before` and the terms carry-through in the OAuth state (`acceptedTermsVersion`). Don't weaken `requireEmailVerification: true` or `magicLink({ disableSignUp: true })`.
- **Accessibility baseline (WCAG A):** every control is named by its visible label (`<label htmlFor>` ↔ `id`, never an `aria-label` that overrides a visible label); groups use `role="group"` + `aria-labelledby`; live status text is a field's `aria-describedby` target with `aria-live="polite"`; status is colour + icon + text.
- **Design system:** tokens from `apps/ui/src/lib/design-tokens.ts` (`T`); the aurora tokens (`T.accent.aurora`, `--t-aurora-*`) are deprecated and must not be added.
- **Tests:** `apps/ui` vitest picks up `src/**/*.test.ts` (no JSX runtime: component tests use `createElement` and `Object.assign(globalThis, { React })`, with `// @vitest-environment happy-dom`). The Playwright `access` project only exists with `--project=access`, runs `workers: 1`, `trace: off`, and every spec there imports from `../../helpers/access-fixtures`.
- **Verification commands** (the whole set must pass before the phase is done):
  ```bash
  source ~/.nvm/nvm.sh && nvm use 22
  cd apps/ui && npx vitest run && npx tsc --noEmit
  cd qa/tests/playwright && pnpm seed:access && npx playwright test --project=access
  ```

---

### Task 1: Magic-link sign-in goes through `/auth/post-signin`

**Files:**

- Create: `apps/ui/src/lib/auth-redirects.ts`
- Test: `apps/ui/src/lib/__tests__/auth-redirects.test.ts`
- Modify: `apps/ui/src/app/[locale]/auth/signin/_components/SignInForm.tsx:87-107`
- Modify: `apps/ui/src/app/[locale]/auth/magic-link/_components/MagicLinkVerifyContent.tsx`

**Interfaces:**

- Produces: `magicLinkCallbacks(callbackUrl: string | null | undefined): { callbackURL: string; errorCallbackURL: string }` and the constants `POST_SIGNIN_PATH = "/auth/post-signin"`, `MAGIC_LINK_ERROR_PATH = "/auth/magic-link"` from `@/lib/auth-redirects`. Task 2's E2E asserts the exact `callbackURL` shape this produces.

**Background the implementer needs.** Better Auth's magic-link verify endpoint (`node_modules/better-auth/dist/plugins/magic-link/index.mjs`, `magicLinkVerify`) runs `decodeURIComponent(ctx.query.callbackURL)` once before redirecting, so a `next=` query inside the callback must be encoded **twice**, or a destination containing `&` is split. On error it redirects to `errorCallbackURL` (or the callback when unset) with `?error=<code>`; codes are `INVALID_TOKEN`, `EXPIRED_TOKEN`, `new_user_signup_disabled` (unknown email, because `disableSignUp: true`), `failed_to_create_session`. Tokens expire after 300 s (`expiresIn` default), which is what `sendMagicLinkEmail` already says.

- [ ] **Step 1: Write the failing unit test**

`apps/ui/src/lib/__tests__/auth-redirects.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  MAGIC_LINK_ERROR_PATH,
  magicLinkCallbacks,
  POST_SIGNIN_PATH,
} from "../auth-redirects"

/** What Better Auth's verify endpoint does to callbackURL before redirecting. */
function asBetterAuthRedirects(callbackURL: string): URL {
  return new URL(decodeURIComponent(callbackURL), "http://localhost:3000")
}

describe("magicLinkCallbacks", () => {
  it("lands on post-signin with no next when the destination is home", () => {
    expect(magicLinkCallbacks("/")).toEqual({
      callbackURL: POST_SIGNIN_PATH,
      errorCallbackURL: MAGIC_LINK_ERROR_PATH,
    })
    expect(magicLinkCallbacks(null).callbackURL).toBe(POST_SIGNIN_PATH)
    expect(magicLinkCallbacks(undefined).callbackURL).toBe(POST_SIGNIN_PATH)
  })

  it("carries the destination as next, encoded for Better Auth's decode", () => {
    const { callbackURL } = magicLinkCallbacks("/libraries?view=list&sort=name")

    expect(callbackURL).toBe(
      "/auth/post-signin?next=%252Flibraries%253Fview%253Dlist%2526sort%253Dname"
    )
    const landed = asBetterAuthRedirects(callbackURL)
    expect(landed.pathname).toBe("/auth/post-signin")
    expect(landed.searchParams.get("next")).toBe(
      "/libraries?view=list&sort=name"
    )
  })

  it("drops unsafe destinations", () => {
    for (const bad of [
      "https://evil.test/",
      "//evil.test",
      "/\\evil.test",
      "pro",
    ]) {
      expect(magicLinkCallbacks(bad).callbackURL).toBe(POST_SIGNIN_PATH)
    }
  })

  it("always sends errors to the magic-link page", () => {
    expect(magicLinkCallbacks("/pro").errorCallbackURL).toBe("/auth/magic-link")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/ui && npx vitest run src/lib/__tests__/auth-redirects.test.ts`
Expected: FAIL, "Failed to resolve import "../auth-redirects"".

- [ ] **Step 3: Write the helper**

`apps/ui/src/lib/auth-redirects.ts`:

```ts
import { safeRedirectPath } from "./safe-redirect"

/** Decides "onboarding or destination" for every sign-in path. */
export const POST_SIGNIN_PATH = "/auth/post-signin"

/** Shows a magic link's error (`?error=<code>`). */
export const MAGIC_LINK_ERROR_PATH = "/auth/magic-link"

/**
 * The `callbackURL` and `errorCallbackURL` for `authClient.signIn.magicLink`.
 *
 * A verified link must land on post-signin, which sends a user who has never
 * onboarded to onboarding; going straight to the destination skipped it.
 *
 * Better Auth's verify endpoint runs `decodeURIComponent` on the callback once
 * before redirecting, so `next` is encoded twice: after that decode the
 * post-signin page still receives one encoded value, and a destination that
 * contains `&` survives intact.
 */
export function magicLinkCallbacks(callbackUrl: string | null | undefined): {
  callbackURL: string
  errorCallbackURL: string
} {
  const next = safeRedirectPath(callbackUrl)
  const callbackURL =
    next === "/"
      ? POST_SIGNIN_PATH
      : `${POST_SIGNIN_PATH}?next=${encodeURIComponent(encodeURIComponent(next))}`

  return { callbackURL, errorCallbackURL: MAGIC_LINK_ERROR_PATH }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/ui && npx vitest run src/lib/__tests__/auth-redirects.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Use it in the sign-in form**

In `SignInForm.tsx`, add the import and replace the `signIn.magicLink` call:

```ts
import { magicLinkCallbacks } from "@/lib/auth-redirects"
```

```ts
  // The sign-in link reuses the email field above instead of a second input.
  // The link lands on post-signin (onboarding for a first sign-in), never on
  // the destination directly.
  const sendMagicLink = async () => {
    const valid = await form.trigger("email", { shouldFocus: true })
    if (!valid) return
    setMagicPending(true)
    try {
      const result = await authClient.signIn.magicLink({
        email: form.getValues("email"),
        ...magicLinkCallbacks(callbackUrl),
      })
```

The rest of the function is unchanged.

- [ ] **Step 6: Make the magic-link page tell the truth**

In `MagicLinkVerifyContent.tsx`:

1. Map the known error codes to plain copy. Add above the component:

```ts
/** Better Auth's magic-link error codes, in plain words. */
const ERROR_COPY: Record<string, string> = {
  INVALID_TOKEN:
    "This sign-in link isn't valid. It may have been used already.",
  EXPIRED_TOKEN: "This sign-in link has expired.",
  new_user_signup_disabled:
    "There's no account for that email address yet. Create an account first.",
  failed_to_create_session: "We couldn't sign you in. Please try again.",
}

function describeError(error: string): string {
  if (ERROR_COPY[error]) return ERROR_COPY[error]
  try {
    return decodeURIComponent(error)
  } catch {
    return error
  }
}
```

and replace the IIFE inside the error `<p>` with `{describeError(error)}`.

2. Change "Magic links expire after 10 minutes and can only be used once." to "Sign-in links expire after 5 minutes and can only be used once."

3. Replace the deprecated tokens: `background: "var(--t-aurora-soft)"` → `background: T.accent.chip`; `border: \`1px solid var(--t-aurora-edge)\``→`border: \`1px solid ${T.border.hi}\``; `color: T.accent.aurora`→`color: T.accent.primary`.

4. Add a "Request a new link" affordance next to "Back to sign in": the existing `GlobalLink` keeps `href="/auth/signin"`; change its text to "← Back to sign in and request a new link".

- [ ] **Step 7: Typecheck and run the UI suite**

Run: `cd apps/ui && npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass (the existing `native-submit.test.ts` mocks `authClient.signIn.magicLink`, so the form still renders).

- [ ] **Step 8: Commit**

```bash
git add apps/ui/src/lib/auth-redirects.ts apps/ui/src/lib/__tests__/auth-redirects.test.ts "apps/ui/src/app/[locale]/auth/signin/_components/SignInForm.tsx" "apps/ui/src/app/[locale]/auth/magic-link/_components/MagicLinkVerifyContent.tsx"
git commit -m "fix(ui): send magic-link sign-ins through post-signin" -- apps/ui/src/lib/auth-redirects.ts apps/ui/src/lib/__tests__/auth-redirects.test.ts "apps/ui/src/app/[locale]/auth/signin/_components/SignInForm.tsx" "apps/ui/src/app/[locale]/auth/magic-link/_components/MagicLinkVerifyContent.tsx"
```

---

### Task 2: Magic-link E2E, with a database helper and shared UI flows

**Files:**

- Modify: `qa/tests/playwright/helpers/access-fixtures.ts:60-71` (add the `magic-link` fixture)
- Create: `qa/tests/playwright/helpers/auth-db.ts`
- Create: `qa/tests/playwright/helpers/ui-flows.ts`
- Modify: `qa/tests/playwright/e2e/access/onboarding.spec.ts` (use the shared flows)
- Create: `qa/tests/playwright/e2e/access/magic-link.spec.ts`

**Interfaces:**

- Consumes: `magicLinkCallbacks` output shape from Task 1: `callbackURL` is `/auth/post-signin?next=<double-encoded>` and `errorCallbackURL` is `/auth/magic-link`.
- Produces (for Task 3):
  - `helpers/auth-db.ts`: `withAuthDb<T>(fn: (db: Client) => Promise<T>): Promise<T>`, `latestMagicLinkToken(email: string): Promise<string>`, `setEmailVerified(email: string): Promise<void>`, `authUserByEmail(email: string): Promise<{ id: string; emailVerified: boolean; termsVersion: string | null; termsAcceptedAt: Date | null } | null>`.
  - `helpers/ui-flows.ts`: `NAVIGATION`, `setSecretValue(locator, value)`, `signInThroughForm(page, email)`, `requestMagicLinkThroughForm(page, email, callbackUrl): Promise<{ callbackURL: string; errorCallbackURL: string }>`, `sessionUser(page)`, `completeOnboarding(page, username)`.

- [ ] **Step 1: Add the fixture**

In `access-fixtures.ts`, add after the `onboarding` row:

```ts
  // Never onboarded, like `onboarding`, but only signed in by magic link
  // (magic-link.spec.ts), which leaves it un-onboarded, so it needs no reset.
  { key: "magic-link", role: "reader", claim: false, username: null },
```

The seed derives everything from `FIXTURES`, so `seed-access-fixtures.ts` needs no code change. Update its header comment "one that hasn't onboarded yet" to "two that haven't onboarded yet".

- [ ] **Step 2: The database helper**

`qa/tests/playwright/helpers/auth-db.ts`:

```ts
/**
 * Reads and one-line writes against the local Better Auth database, for the
 * access specs. Local only: refuses a non-loopback BA_DATABASE_URL, like the
 * seed. Never logs a token, a URL or a row.
 */
import { Client } from "pg"

const LOCAL = /^(localhost|127\.0\.0\.1)$/

function connectionString(): string {
  const raw = process.env.BA_DATABASE_URL
  if (!raw)
    throw new Error("BA_DATABASE_URL is not set (qa/tests/playwright/.env)")
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("Invalid BA_DATABASE_URL")
  }
  if (!LOCAL.test(url.hostname) || url.searchParams.has("host"))
    throw new Error("Refusing: BA_DATABASE_URL is not local")

  return raw
}

export async function withAuthDb<T>(
  fn: (db: Client) => Promise<T>
): Promise<T> {
  const db = new Client({ connectionString: connectionString() })
  await db.connect()
  try {
    return await fn(db)
  } finally {
    await db.end()
  }
}

/**
 * The newest unexpired magic-link token for `email`. The magicLink plugin
 * stores the raw token as the verification row's identifier and
 * `{ email, name }` as its value.
 */
export async function latestMagicLinkToken(email: string): Promise<string> {
  return withAuthDb(async (db) => {
    const { rows } = await db.query<{ identifier: string; value: string }>(
      `SELECT identifier, value FROM "verification"
         WHERE "expiresAt" > now()
         ORDER BY "createdAt" DESC
         LIMIT 20`
    )
    for (const row of rows) {
      try {
        if ((JSON.parse(row.value) as { email?: string }).email === email)
          return row.identifier
      } catch {
        // Not a magic-link row (other verification values aren't JSON).
      }
    }
    throw new Error(`No unexpired magic-link token for ${email}`)
  })
}

export async function setEmailVerified(email: string): Promise<void> {
  await withAuthDb(async (db) => {
    const { rowCount } = await db.query(
      `UPDATE "user" SET "emailVerified" = true WHERE email = $1`,
      [email]
    )
    if (!rowCount) throw new Error(`No Better Auth user for ${email}`)
  })
}

export async function authUserByEmail(email: string): Promise<{
  id: string
  emailVerified: boolean
  termsVersion: string | null
  termsAcceptedAt: Date | null
} | null> {
  return withAuthDb(async (db) => {
    const { rows } = await db.query(
      `SELECT id, "emailVerified", "termsVersion", "termsAcceptedAt"
         FROM "user" WHERE email = $1`,
      [email]
    )

    return rows[0] ?? null
  })
}
```

- [ ] **Step 3: The shared UI flows**

`qa/tests/playwright/helpers/ui-flows.ts`: move `signInThroughForm`, `sessionUser` and the constants out of `onboarding.spec.ts`, generalise them to take an email, and add the magic-link and onboarding flows.

```ts
import { expect, type Locator, type Page } from "@playwright/test"

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
export const USERNAME_LABEL = "Username * → libraries.global/@handle"

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

/** The link Better Auth would have emailed, rebuilt from its parts. */
export function magicLinkVerifyUrl(
  token: string,
  callbacks: { callbackURL: string; errorCallbackURL: string }
): string {
  const params = new URLSearchParams({
    token,
    callbackURL: callbacks.callbackURL,
    errorCallbackURL: callbacks.errorCallbackURL,
  })

  return `/api/auth/magic-link/verify?${params.toString()}`
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
    page.getByLabel("Display name *", { exact: true })
  ).not.toHaveValue("")
  const usernameInput = page.getByLabel(USERNAME_LABEL, { exact: true })
  await usernameInput.fill(username)
  await expect(page.getByText("Available ✓")).toBeVisible(NAVIGATION)
  await expect(usernameInput).toHaveAccessibleDescription("Available ✓")
  await page
    .getByLabel("Pronouns *", { exact: true })
    .selectOption({ label: "Prefer not to say" })
  const reader = page
    .getByRole("group", { name: "Affiliation" })
    .getByRole("button", { name: "Reader / enthusiast" })
  await reader.click()
  await expect(reader).toHaveAttribute("aria-pressed", "true")
  await enterProfile.click()

  await expect(page).toHaveURL(new RegExp(`/profile/${username}$`), NAVIGATION)
}
```

- [ ] **Step 4: Point `onboarding.spec.ts` at the shared flows**

Replace its local `USERNAME_LABEL`, `NAVIGATION`, `signInThroughForm` and `sessionUser` with imports from `../../helpers/ui-flows`, and its inline onboarding steps with `completeOnboarding(page, username)`. The test body becomes:

```ts
import { expect, test } from "@playwright/test"

import { emailFor, signIn } from "../../helpers/access-fixtures"
import {
  completeOnboarding,
  NAVIGATION,
  sessionUser,
  signInThroughForm,
} from "../../helpers/ui-flows"

// (keep the existing header comment and the beforeAll unchanged)

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
```

Keep `test.describe.configure({ mode: "serial", timeout: 300_000 })` and the `beforeAll`.

- [ ] **Step 5: Write the magic-link spec**

`qa/tests/playwright/e2e/access/magic-link.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

import { emailFor } from "../../helpers/access-fixtures"
import { latestMagicLinkToken } from "../../helpers/auth-db"
import {
  magicLinkVerifyUrl,
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
  await page.goto(magicLinkVerifyUrl(token, callbacks))

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
  await page.goto(magicLinkVerifyUrl(token, callbacks))

  await expect(page).toHaveURL(/\/pro$/, NAVIGATION)
  const user = await sessionUser(page)
  expect(user?.email).toBe(email)
  expect(user?.username).toBe("access_reader")
})

test("a bad token shows the magic-link error page, signed out", async ({
  page,
}) => {
  await page.goto(
    magicLinkVerifyUrl("not-a-real-token", {
      callbackURL: "/auth/post-signin",
      errorCallbackURL: "/auth/magic-link",
    })
  )

  await expect(page).toHaveURL(
    /\/auth\/magic-link\?error=INVALID_TOKEN$/,
    NAVIGATION
  )
  await expect(
    page.getByRole("heading", { name: "Link verification failed" })
  ).toBeVisible()
  await expect(
    page.getByText(
      "This sign-in link isn't valid. It may have been used already."
    )
  ).toBeVisible()
  expect(await sessionUser(page)).toBeNull()
})
```

Note on the onboarding URL: `post-signin` builds `?next=${encodeURIComponent(destination)}` once, so the expected value is single-encoded.

- [ ] **Step 6: Seed and run the access project**

Run (with both dev servers up):

```bash
cd qa/tests/playwright && pnpm seed:access && npx playwright test --project=access
```

Expected: the seed prints a line for `access-magic-link@example.test` ("created … onboarding pending"); all specs pass (16 existing + 3 new). If the magic-link spec fails with "No unexpired magic-link token", the UI's sign-in request was refused: read the `x-retry-after` handling in `submitAndWait` before touching anything else.

- [ ] **Step 7: Lint and commit**

```bash
cd qa/tests/playwright && pnpm lint
git add qa/tests/playwright/helpers/access-fixtures.ts qa/tests/playwright/helpers/seed-access-fixtures.ts qa/tests/playwright/helpers/auth-db.ts qa/tests/playwright/helpers/ui-flows.ts qa/tests/playwright/e2e/access/onboarding.spec.ts qa/tests/playwright/e2e/access/magic-link.spec.ts
git commit -m "test(tests-playwright): e2e for magic-link sign-in and onboarding" -- qa/tests/playwright/helpers/access-fixtures.ts qa/tests/playwright/helpers/seed-access-fixtures.ts qa/tests/playwright/helpers/auth-db.ts qa/tests/playwright/helpers/ui-flows.ts qa/tests/playwright/e2e/access/onboarding.spec.ts qa/tests/playwright/e2e/access/magic-link.spec.ts
```

---

### Task 3: The register funnel E2E: terms, verification, sign-in, onboarding, deletion

**Files:**

- Create: `qa/tests/playwright/e2e/access/register-funnel.spec.ts`

**Interfaces:**

- Consumes: `authUserByEmail`, `setEmailVerified` (`helpers/auth-db.ts`); `signInThroughForm`, `setSecretValue`, `completeOnboarding`, `sessionUser`, `NAVIGATION` (`helpers/ui-flows.ts`); `fixturePassword`, `retryAfterMs`, `sleep` (`helpers/access-fixtures.ts`); `TERMS_VERSION` from `apps/ui/src/lib/legal-consent` (the seed already imports it by relative path).

**Budget:** `/sign-up/email` 2 of 3 (one refused API call, one UI sign-up); `/sign-in/email` 2 of 5 (one refused before verification, one after). The account is created fresh every run and deleted at the end through the real deletion route, so nothing accumulates; the Strapi profile is anonymised by `eraseAccount` (its username becomes `deleted-<n>`).

- [ ] **Step 1: Write the spec**

`qa/tests/playwright/e2e/access/register-funnel.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test"

import {
  fixturePassword,
  retryAfterMs,
  sleep,
} from "../../helpers/access-fixtures"
import { authUserByEmail, setEmailVerified } from "../../helpers/auth-db"
import {
  completeOnboarding,
  NAVIGATION,
  sessionUser,
  setSecretValue,
  signInThroughForm,
} from "../../helpers/ui-flows"
import { TERMS_VERSION } from "../../../../apps/ui/src/lib/legal-consent"

// Local only, opt-in (the access project). A fresh account is registered
// through the UI on every run and deleted at the end through the account
// deletion route, so the run leaves nothing behind but an anonymised profile.
// Budget: 2 of 3 sign-ups and 2 of 5 sign-ins a minute.

test.describe.configure({ mode: "serial", timeout: 300_000 })

const stamp = Date.now() % 1e6
const EMAIL = `access-funnel-${stamp}@example.test`
const USERNAME = `access_funnel_${stamp}`
const TERMS_LABEL =
  /I’m 18 or over, and I agree to the terms of use and privacy notice\./

async function fillRegisterForm(page: Page) {
  await page.goto("/auth/register")
  const submit = page.getByRole("button", { name: "Continue", exact: true })
  await expect(submit).toBeEnabled(NAVIGATION)
  await page.getByLabel("Display name", { exact: false }).fill("Access Funnel")
  await page.getByLabel("Email address", { exact: true }).fill(EMAIL)
  await setSecretValue(
    page.getByLabel("Create a password", { exact: true }),
    fixturePassword()
  )

  return submit
}

test("the API refuses a sign-up without the current terms version", async ({
  request,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL!
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email: EMAIL, password: fixturePassword(), name: "No Terms" },
      headers: { Origin: baseURL },
    })
    if (res.status() === 429) {
      await sleep(retryAfterMs(res.headers()["x-retry-after"]))
      continue
    }
    expect(res.status()).toBe(400)
    expect((await res.json()).message).toContain("18 or over")
    expect(await authUserByEmail(EMAIL)).toBeNull()

    return
  }
  throw new Error("sign-up stayed rate-limited")
})

test("the register form requires the terms box, then records the acceptance", async ({
  page,
}) => {
  const submit = await fillRegisterForm(page)

  // Unticked: the form refuses locally and no request leaves the browser.
  let posted = false
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/auth/sign-up/email") posted = true
  })
  await submit.click()
  await expect(
    page.getByText(
      "Confirm you're 18 or over and accept the terms and privacy notice"
    )
  ).toBeVisible()
  expect(posted).toBe(false)

  // Ticked: the account is created, unverified, with the terms recorded.
  await page.getByLabel(TERMS_LABEL).check()
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/auth/sign-up/email",
    { timeout: 30_000 }
  )
  await submit.click()
  const res = await response
  if (res.status() === 429) {
    await sleep(retryAfterMs(res.headers()["x-retry-after"]))
    await submit.click()
  }
  await expect(page).toHaveURL(/\/auth\/verify-email-sent/, NAVIGATION)

  const user = await authUserByEmail(EMAIL)
  expect(user?.emailVerified).toBe(false)
  expect(user?.termsVersion).toBe(TERMS_VERSION)
  expect(user?.termsAcceptedAt).not.toBeNull()
})

test("sign-in is refused until the email is verified", async ({ page }) => {
  const res = await signInThroughForm(page, EMAIL)
  expect(res.status()).toBe(403)
  await expect(
    page.getByText("Please confirm your email address first", { exact: false })
  ).toBeVisible()
  expect(await sessionUser(page)).toBeNull()
})

test("a verified user signs in, onboards and can delete the account", async ({
  page,
}) => {
  // The verification link is a signed JWT, not a row, so the seed's approach
  // is reused: flip the flag directly.
  await setEmailVerified(EMAIL)

  const res = await signInThroughForm(page, EMAIL, "/pro")
  expect(res.status()).toBe(200)
  await completeOnboarding(page, USERNAME)
  const user = await sessionUser(page)
  expect(user?.username).toBe(USERNAME)
  expect(user?.plan).toBe("free")

  // Deletion: the same route the settings page calls.
  const del = await page.request.delete("/api/profile/me")
  expect(del.status()).toBe(200)
  await expect.poll(() => sessionUser(page)).toBeNull()
  expect(await authUserByEmail(EMAIL)).toBeNull()
  const profile = await page.request.get(`/api/profile/${USERNAME}`)
  expect(profile.status()).toBe(404)
})
```

If `GET /api/profile/[username]` doesn't exist in `apps/ui/src/app/api/profile/`, replace the last two lines with a visit: `await page.goto(\`/profile/${USERNAME}\`)`then`await expect(page.getByRole("heading", { name: /not found|doesn’t exist/i })).toBeVisible(NAVIGATION)`, using whatever heading `app/[locale]/profile/[username]/page.tsx` renders for an unknown username (read it; don't guess).

- [ ] **Step 2: Run the access project**

```bash
cd qa/tests/playwright && pnpm seed:access && npx playwright test --project=access
```

Expected: all specs pass. If the terms-refusal test's `message` assertion fails, check the JSON shape Better Auth returns for an `APIError("BAD_REQUEST", { message })` (it is `{ code, message }`).

- [ ] **Step 3: Lint and commit**

```bash
cd qa/tests/playwright && pnpm lint
git add qa/tests/playwright/e2e/access/register-funnel.spec.ts
git commit -m "test(tests-playwright): e2e for the register, verify and delete funnel" -- qa/tests/playwright/e2e/access/register-funnel.spec.ts
```

---

### Task 4: Settings form accessibility (labels, comboboxes, avatar)

**Files:**

- Modify: `apps/ui/src/app/[locale]/profile/settings/_components/PublicProfileSection.tsx`
- Modify: `apps/ui/src/components/settings/AvatarUpload.tsx`
- Modify: `apps/ui/src/components/settings/CountryCombobox.tsx:76-82`
- Modify: `apps/ui/src/components/settings/TimezoneCombobox.tsx:100-105`
- Test: `apps/ui/src/app/[locale]/profile/settings/_components/__tests__/settings-labels.test.ts`

**Interfaces:**

- Consumes: `CountryCombobox` / `TimezoneCombobox` already accept `id` and `labelledBy` (the trigger is then named "label + current value").
- Produces: `AvatarUpload` gains an optional `label?: string` prop (default `"Profile photo"`), used for the picture button's accessible name.

- [ ] **Step 1: Write the failing test**

`apps/ui/src/app/[locale]/profile/settings/_components/__tests__/settings-labels.test.ts`:

```ts
// @vitest-environment happy-dom
// apps/ui/src/app/[locale]/profile/settings/_components/__tests__/settings-labels.test.ts
//
// Every settings control is named by its visible label (WCAG 1.3.1, 4.1.2),
// the pickers say they open a list and whether it's open, the username and
// bio statuses are live descriptions, and the photo buttons say what they do.
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ saving: false, updateProfile: vi.fn(async () => true) }),
}))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
    useRouter: () => ({ push: vi.fn() }),
  }
})

const { PublicProfileSection } = await import("../PublicProfileSection")

function respond(url: string) {
  if (url.startsWith("/api/topics"))
    return Response.json({ data: [{ documentId: "t1", name: "Manuscripts" }] })
  if (url.startsWith("/api/profile/check-username"))
    return Response.json({ available: true })

  return Response.json({})
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => respond(url))
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function renderSection() {
  render(
    createElement(PublicProfileSection, {
      profile: null,
      sessionUser: {
        id: "u1",
        email: "amelie@example.test",
        name: "Amélie Rault",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
  )
  await screen.findByRole("button", { name: "Manuscripts" })
}

describe("PublicProfileSection", () => {
  it("names each field by its visible label", async () => {
    await renderSection()

    for (const label of [
      "First name",
      "Last name",
      "Username",
      "Pronouns · Optional",
      "Bio",
      "Job title · Optional",
      "City",
      "Website",
      "ORCID iD",
      "Mastodon or Bluesky",
      "LinkedIn",
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy()
    }
    expect(screen.getByLabelText("Username").hasAttribute("aria-label")).toBe(
      false
    )
    screen.getByRole("button", { name: "Country Select country…" })
    screen.getByRole("button", { name: "Time zone Select timezone…" })
  })

  it("says the username status in a live description, not in its name", async () => {
    await renderSection()
    const input = screen.getByLabelText("Username")

    fireEvent.change(input, { target: { value: "amelie" } })
    await screen.findByText("Available")

    expect(
      screen.getByRole("textbox", {
        name: "Username",
        description: "Available",
      })
    ).toBe(input)
    const status = document.getElementById(
      input.getAttribute("aria-describedby")!
    )
    expect(status?.getAttribute("aria-live")).toBe("polite")
  })

  it("describes the bio by its character count", async () => {
    await renderSection()

    screen.getByRole("textbox", { name: "Bio", description: "0 / 400" })
  })

  it("marks the pickers as popups and reports when they are open", async () => {
    await renderSection()
    const country = screen.getByRole("button", {
      name: "Country Select country…",
    })

    expect(country.getAttribute("aria-haspopup")).toBe("listbox")
    expect(country.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(country)
    expect(country.getAttribute("aria-expanded")).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Time zone Select timezone…" })
        .getAttribute("aria-haspopup")
    ).toBe("listbox")
  })

  it("names the photo buttons by what they do, not by the initials", async () => {
    await renderSection()

    screen.getByRole("button", { name: "Profile photo: add a photo" })
    screen.getByRole("button", { name: "Upload new photo" })
    expect(screen.queryByRole("button", { name: "AR" })).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/ui && npx vitest run "src/app/\[locale\]/profile/settings/_components/__tests__/settings-labels.test.ts"`
Expected: FAIL on "First name" (no label association), and the picker names.

- [ ] **Step 3: Wire the labels in `PublicProfileSection.tsx`**

Add `useId` to the React import and, inside the component after `const router = useRouter()`:

```ts
const uid = useId()
const ids = {
  firstName: `${uid}-first-name`,
  lastName: `${uid}-last-name`,
  username: `${uid}-username`,
  usernameStatus: `${uid}-username-status`,
  pronouns: `${uid}-pronouns`,
  bio: `${uid}-bio`,
  bioCount: `${uid}-bio-count`,
  library: `${uid}-library`,
  jobTitle: `${uid}-job-title`,
  city: `${uid}-city`,
  country: `${uid}-country`,
  countryLabel: `${uid}-country-label`,
  timezone: `${uid}-timezone`,
  timezoneLabel: `${uid}-timezone-label`,
  website: `${uid}-website`,
  orcid: `${uid}-orcid`,
  mastodon: `${uid}-mastodon`,
  linkedin: `${uid}-linkedin`,
}
```

Then, for each plain field, give the `<label>` an `htmlFor` and the control the matching `id`:

```tsx
<label htmlFor={ids.firstName} style={labelStyle}>First name</label>
<input id={ids.firstName} style={inputStyle} type="text" {...field("firstName")} />
```

Do the same for `lastName`, `jobTitle` (label text stays "Job title · Optional"), `city`, `website`, `orcid`, `mastodon`, `linkedin`, `pronouns` (the `<select>`) and the read-only library input (`id={ids.library}`, label `htmlFor={ids.library}`; when no library is linked, keep the label but render it as `<span style={labelStyle}>Library</span>` since there is no control).

Username: the label keeps its flex layout but gets `htmlFor={ids.username}`; its left `<span>` stays "Username"; the right-hand status spans move out of the label into one element after the input:

```tsx
<label htmlFor={ids.username} style={labelStyle}>Username</label>
<div className="flex items-center …">   {/* unchanged wrapper */}
  <span aria-hidden="true" …>@</span>
  <input
    id={ids.username}
    aria-describedby={ids.usernameStatus}
    … (remove aria-label="Username"; everything else unchanged)
  />
</div>
<p id={ids.usernameStatus} aria-live="polite" className="m-0 mt-1 text-[13px]"
   style={{ minHeight: "18px", color: usernameStatus === "taken" ? T.accent.danger : usernameStatus === "available" ? T.accent.ok : T.ink.faint }}>
  {usernameStatus === "checking" && "Checking…"}
  {usernameStatus === "available" && "Available"}
  {usernameStatus === "taken" && "Taken"}
</p>
```

Bio: `<label htmlFor={ids.bio}>` with the text "Bio", the counter becomes `<span id={ids.bioCount} …>{form.bio.length} / 400</span>` (still inside the label's flex row is fine, but then `getByLabelText("Bio")` would see "Bio 0 / 400"; so move the counter out of the label into a sibling `<span>` positioned with the same flex wrapper), and `<textarea id={ids.bio} aria-describedby={ids.bioCount} …>`.

Country and time zone:

```tsx
<label id={ids.countryLabel} htmlFor={ids.country} style={labelStyle}>Country</label>
<CountryCombobox id={ids.country} labelledBy={ids.countryLabel} value={form.country} onChange={…} />

<label id={ids.timezoneLabel} htmlFor={ids.timezone} style={labelStyle}>Time zone</label>
<TimezoneCombobox id={ids.timezone} labelledBy={ids.timezoneLabel} value={form.timezone} onChange={…} />
```

- [ ] **Step 4: Comboboxes announce their popup**

In both `CountryCombobox.tsx` and `TimezoneCombobox.tsx`, the trigger `<button>` gets:

```tsx
        aria-haspopup="listbox"
        aria-expanded={open}
```

- [ ] **Step 5: Name the avatar buttons**

In `AvatarUpload.tsx`, add the prop and use it:

```tsx
export function AvatarUpload({
  currentUrl,
  initials,
  onUpload,
  label = "Profile photo",
}: {
  currentUrl?: string | null
  initials: string
  onUpload: (url: string) => void
  /** What the picture is, for its accessible name ("Profile photo: change the photo"). */
  label?: string
}) {
```

The picture button gets `aria-label={\`${label}: ${preview ? "change the photo" : "add a photo"}\`}`; the `<img>` becomes decorative (`alt=""`) because the button carries the name; the initials fallback is wrapped in `<span aria-hidden="true">{initials}</span>`. The "Upload new photo" button is unchanged. The hint paragraph gets an id and both buttons `aria-describedby` it:

```tsx
const hintId = useId()
…
<button … aria-describedby={hintId}>   // both buttons
…
<p id={hintId} …>JPG · PNG · WebP · max 5 MB</p>
```

(`useId` joins the React import.) `OnboardingShell` also renders `AvatarUpload`; the default label keeps its existing test green.

- [ ] **Step 6: Run the tests**

Run: `cd apps/ui && npx vitest run && npx tsc --noEmit`
Expected: the new file's 5 tests pass, `onboarding-labels.test.ts` still passes, no type errors.

- [ ] **Step 7: Commit**

```bash
git add "apps/ui/src/app/[locale]/profile/settings/_components/PublicProfileSection.tsx" "apps/ui/src/app/[locale]/profile/settings/_components/__tests__/settings-labels.test.ts" apps/ui/src/components/settings/AvatarUpload.tsx apps/ui/src/components/settings/CountryCombobox.tsx apps/ui/src/components/settings/TimezoneCombobox.tsx
git commit -m "fix(ui): give every profile settings field an accessible name" -- "apps/ui/src/app/[locale]/profile/settings/_components/PublicProfileSection.tsx" "apps/ui/src/app/[locale]/profile/settings/_components/__tests__/settings-labels.test.ts" apps/ui/src/components/settings/AvatarUpload.tsx apps/ui/src/components/settings/CountryCombobox.tsx apps/ui/src/components/settings/TimezoneCombobox.tsx
```

---

### Task 5: Email delivery: provider selection under test, and the production env documented

**Files:**

- Modify: `apps/ui/src/lib/email.ts`
- Test: `apps/ui/src/lib/__tests__/email.test.ts`
- Modify: `docs/pre-golive-checklist.md` §4 and §5

**Interfaces:**

- Produces: `createTransporter()` becomes an exported function `emailTransport(): { name: "mailtrap" | "mailgun"; transporter: Transporter } | null` so the test can assert which provider was chosen without sending.

- [ ] **Step 1: Write the failing test**

`apps/ui/src/lib/__tests__/email.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sendMail = vi.fn(async () => ({}))
const createTransport = vi.fn(() => ({ sendMail }))
vi.mock("nodemailer", () => ({ default: { createTransport } }))

const ENV_KEYS = [
  "MAILTRAP_HOST",
  "MAILTRAP_PORT",
  "MAILTRAP_USER",
  "MAILTRAP_PASS",
  "MAILGUN_SMTP_HOST",
  "MAILGUN_SMTP_USER",
  "MAILGUN_SMTP_PASS",
  "EMAIL_FROM",
]

beforeEach(() => {
  vi.resetModules()
  createTransport.mockClear()
  sendMail.mockClear()
  for (const key of ENV_KEYS) vi.stubEnv(key, "")
  vi.stubEnv("NODE_ENV", "test")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

async function load() {
  return import("../email")
}

describe("email delivery", () => {
  it("prefers Mailtrap when its credentials are set", async () => {
    vi.stubEnv("MAILTRAP_USER", "u")
    vi.stubEnv("MAILTRAP_PASS", "p")
    vi.stubEnv("MAILGUN_SMTP_USER", "mu")
    vi.stubEnv("MAILGUN_SMTP_PASS", "mp")
    const { emailTransport } = await load()

    expect(emailTransport()?.name).toBe("mailtrap")
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "sandbox.smtp.mailtrap.io", port: 2525 })
    )
  })

  it("uses Mailgun on port 587 when only Mailgun is set", async () => {
    vi.stubEnv("MAILGUN_SMTP_USER", "mu")
    vi.stubEnv("MAILGUN_SMTP_PASS", "mp")
    vi.stubEnv("MAILGUN_SMTP_HOST", "smtp.eu.mailgun.org")
    const { emailTransport } = await load()

    expect(emailTransport()?.name).toBe("mailgun")
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.eu.mailgun.org", port: 587 })
    )
  })

  it("sends each message from EMAIL_FROM with the link in the body", async () => {
    vi.stubEnv("MAILTRAP_USER", "u")
    vi.stubEnv("MAILTRAP_PASS", "p")
    vi.stubEnv("EMAIL_FROM", "Libraries Global <noreply@example.test>")
    const {
      sendMagicLinkEmail,
      sendResetPasswordEmail,
      sendVerificationEmail,
    } = await load()

    await sendMagicLinkEmail("a@example.test", "https://x.test/m?token=1")
    await sendResetPasswordEmail("a@example.test", "https://x.test/r?token=2")
    await sendVerificationEmail("a@example.test", "https://x.test/v?token=3")

    expect(sendMail).toHaveBeenCalledTimes(3)
    for (const [call, link] of [
      [0, "https://x.test/m?token=1"],
      [1, "https://x.test/r?token=2"],
      [2, "https://x.test/v?token=3"],
    ] as const) {
      const message = sendMail.mock.calls[call]![0] as {
        from: string
        to: string
        text: string
        html: string
      }
      expect(message.from).toBe("Libraries Global <noreply@example.test>")
      expect(message.to).toBe("a@example.test")
      expect(message.text).toContain(link)
      expect(message.html).toContain(`href="${link}"`)
    }
  })

  it("logs the link in development when no provider is set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { sendMagicLinkEmail } = await load()

    await sendMagicLinkEmail("a@example.test", "https://x.test/m?token=1")

    expect(sendMail).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("https://x.test/m?token=1")
    )
  })

  it("refuses to run in production without a provider", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { sendVerificationEmail } = await load()

    await expect(
      sendVerificationEmail("a@example.test", "https://x.test/v")
    ).rejects.toThrow(/MAILGUN_SMTP_USER|MAILTRAP_USER/)
    expect(sendMail).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/ui && npx vitest run src/lib/__tests__/email.test.ts`
Expected: FAIL, `emailTransport` is not exported.

- [ ] **Step 3: Export the transport chooser and name both providers in the error**

In `email.ts`, replace `createTransporter` with:

```ts
export type EmailTransport = {
  name: "mailtrap" | "mailgun"
  transporter: Transporter
}

/**
 * Mailtrap (a sandbox that catches mail) wins over Mailgun when both are set,
 * so a staging deploy can keep production's Mailgun keys without sending.
 */
export function emailTransport(): EmailTransport | null {
  if (process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS) {
    return {
      name: "mailtrap",
      transporter: nodemailer.createTransport({
        host: process.env.MAILTRAP_HOST || "sandbox.smtp.mailtrap.io",
        port: Number.parseInt(process.env.MAILTRAP_PORT || "2525", 10),
        auth: {
          user: process.env.MAILTRAP_USER,
          pass: process.env.MAILTRAP_PASS,
        },
      }),
    }
  }

  if (process.env.MAILGUN_SMTP_USER && process.env.MAILGUN_SMTP_PASS) {
    return {
      name: "mailgun",
      transporter: nodemailer.createTransport({
        // EU-region Mailgun domains must use smtp.eu.mailgun.org.
        host: process.env.MAILGUN_SMTP_HOST || "smtp.mailgun.org",
        port: 587,
        auth: {
          user: process.env.MAILGUN_SMTP_USER,
          pass: process.env.MAILGUN_SMTP_PASS,
        },
      }),
    }
  }

  return null
}
```

(`||` rather than `??` so an empty string from `vi.stubEnv` or an empty `.env` line falls back.) The three `send*` functions call `emailTransport()` and use `.transporter.sendMail(...)`; `from` becomes `process.env.EMAIL_FROM || DEFAULT_FROM`. The production error message becomes:

```ts
"Email delivery is not configured (set MAILGUN_SMTP_USER/PASS, or MAILTRAP_USER/PASS for a sandbox)."
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/ui && npx vitest run src/lib/__tests__/email.test.ts && npx tsc --noEmit`
Expected: PASS, 5 tests; no type errors.

- [ ] **Step 5: Document the production environment**

In `docs/pre-golive-checklist.md`, replace §4 "Authentication & Roles" and the auth lines of §5 with:

```markdown
## 4. Authentication & Roles

Better Auth runs inside the Next.js app (`apps/ui/src/lib/auth.ts`); Strapi is not involved in sign-in. Every path (password, magic link, Google, email verification) must end on `/auth/post-signin`, which sends a first-time user to onboarding.

### 4a. UI environment (Vercel)

| Variable                                                            | Purpose                                                                                                                                            |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                                                | Session signing. Rotate for production (`openssl rand -base64 32`).                                                                                |
| `APP_PUBLIC_URL`                                                    | `https://libraries.global`. Better Auth `baseURL` and `trustedOrigins`; the sign-in, reset and verification links are built from it.               |
| `NEXT_PUBLIC_APP_URL`                                               | Same value; the browser auth client and `metadataBase`.                                                                                            |
| `DATABASE_URL`                                                      | Postgres for the Better Auth tables (`user`, `session`, `account`, `verification`, `rateLimit`).                                                   |
| `STRAPI_URL`, `STRAPI_BRIDGE_SECRET`                                | The auth-bridge (user sync, profile, session-profile). Rotate the secret; Strapi must hold the same value.                                         |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                          | Google OAuth. Authorised redirect URI: `https://libraries.global/api/auth/callback/google`.                                                        |
| `MAILGUN_SMTP_USER`, `MAILGUN_SMTP_PASS`, `MAILGUN_SMTP_HOST`       | Transactional email. `MAILGUN_SMTP_HOST=smtp.eu.mailgun.org` for an EU-region domain. Production refuses to send sign-in links without a provider. |
| `MAILTRAP_USER`, `MAILTRAP_PASS` (`MAILTRAP_HOST`, `MAILTRAP_PORT`) | Sandbox provider for previews and staging; wins over Mailgun when set. Never set in production.                                                    |
| `EMAIL_FROM`                                                        | Sender, default `"Libraries Global" <noreply@libraries.global>`. The domain must be verified with the provider.                                    |
| `CRON_SECRET`                                                       | Authorises the daily `/api/cron/retention` job (`apps/ui/vercel.json`).                                                                            |

### 4b. Checks

- [ ] Google OAuth end to end on the production domain (new account: terms carried through the OAuth state, lands on onboarding; existing account: lands on its destination). See `qa/tests/manual/auth-checklist.md`.
- [ ] The three emails arrive from `EMAIL_FROM` with working links: verification (register), password reset, magic link.
- [ ] Verify Strapi Roles & Permissions for the `Public` role match `docs/strapi-role-permissions.md`.
- [ ] `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are not read by the app; remove them from every environment unless GitHub sign-in is wired (WP1 Task 6).
```

and delete the now-duplicated `MAILGUN_*` and `CRON_SECRET` bullets from §5. If Task 6a (GitHub) has been done by the time this runs, add the GitHub row and callback URL instead of the removal bullet.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/lib/email.ts apps/ui/src/lib/__tests__/email.test.ts docs/pre-golive-checklist.md
git commit -m "fix(ui): name both email providers and test provider selection" -- apps/ui/src/lib/email.ts apps/ui/src/lib/__tests__/email.test.ts docs/pre-golive-checklist.md
```

---

### Task 6: GitHub OAuth — wire it or drop the claim (owner's decision)

Ask the owner before dispatching. Exactly one of 6a or 6b runs.

#### 6a: Wire GitHub (if wanted)

**Files:**

- Modify: `apps/ui/src/lib/auth.ts:153-158`
- Modify: `apps/ui/src/app/[locale]/auth/_components/AuthOAuthButtons.tsx`
- Test: `apps/ui/src/app/[locale]/auth/_components/__tests__/oauth-buttons.test.ts`
- Modify: `docs/pre-golive-checklist.md` §4a (GitHub row: callback `https://libraries.global/api/auth/callback/github`)

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social: vi.fn() } },
}))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
  }
})

const { AuthOAuthButtons } = await import("../AuthOAuthButtons")

afterEach(cleanup)

describe("AuthOAuthButtons", () => {
  it("offers Google and GitHub, each described by the terms notice", () => {
    render(createElement(AuthOAuthButtons, { mode: "signin" }))

    for (const name of ["Continue with Google", "Continue with GitHub"]) {
      const button = screen.getByRole("button", { name })
      expect(button.getAttribute("aria-describedby")).toBe("oauth-terms")
    }
    expect(screen.getByText(/By continuing with Google or GitHub/)).toBeTruthy()
  })

  it("uses sign-up wording on the register page", () => {
    render(createElement(AuthOAuthButtons, { mode: "register" }))

    screen.getByRole("button", { name: "Sign up with Google" })
    screen.getByRole("button", { name: "Sign up with GitHub" })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/ui && npx vitest run "src/app/\[locale\]/auth/_components/__tests__/oauth-buttons.test.ts"`
Expected: FAIL, no "Continue with GitHub" button.

- [ ] **Step 3: Add the provider server-side**

In `auth.ts` `socialProviders`, after `google`:

```ts
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
```

The `account.create.before` pre-hijack guard and `user.create.before` terms check already cover every non-credential provider; nothing else changes server-side.

- [ ] **Step 4: Add the button**

In `AuthOAuthButtons.tsx`: `type Provider = "google" | "github"`; `useState<Provider | null>`; `handleOAuth(provider: Provider)`; render `<GoogleButton …/>` then `<GitHubButton mode={mode} loading={loading} onClick={() => handleOAuth("github")} />`; the notice reads "By continuing with Google or GitHub, you confirm you're 18 or over and agree to our terms of use and privacy notice." `GitHubButton` mirrors `GoogleButton` with the GitHub mark:

```tsx
function GitHubButton({
  mode,
  loading,
  onClick,
}: {
  mode: AuthOAuthButtonsProps["mode"]
  loading: Provider | null
  onClick: () => void
}) {
  return (
    <AuthSecondaryButton
      disabled={loading !== null}
      onClick={onClick}
      aria-describedby="oauth-terms"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
        />
      </svg>
      {loading === "github" && "Redirecting…"}
      {loading !== "github" &&
        (mode === "signin" ? "Continue with GitHub" : "Sign up with GitHub")}
    </AuthSecondaryButton>
  )
}
```

- [ ] **Step 5: Run the tests, typecheck, commit**

Run: `cd apps/ui && npx vitest run && npx tsc --noEmit`
Expected: PASS (the new file's 2 tests; `native-submit.test.ts` mocks `signIn.social` so it still renders).

```bash
git add apps/ui/src/lib/auth.ts "apps/ui/src/app/[locale]/auth/_components/AuthOAuthButtons.tsx" "apps/ui/src/app/[locale]/auth/_components/__tests__/oauth-buttons.test.ts" docs/pre-golive-checklist.md
git commit -m "feat(ui): sign in with github" -- apps/ui/src/lib/auth.ts "apps/ui/src/app/[locale]/auth/_components/AuthOAuthButtons.tsx" "apps/ui/src/app/[locale]/auth/_components/__tests__/oauth-buttons.test.ts" docs/pre-golive-checklist.md
```

Then the owner registers the GitHub OAuth app callback `${APP_PUBLIC_URL}/api/auth/callback/github` for local (`http://localhost:3000/...`) and production, and the manual checklist (Task 7) covers the run.

#### 6b: Drop the claim (if not wanted)

**Files:** `CLAUDE.md:53`, `docs/pre-golive-checklist.md` (§4b bullet already added in Task 5 says GitHub is unused: keep it).

- [ ] **Step 1:** In `CLAUDE.md` line 53 change "supports credentials + OAuth (GitHub, Google)" to "supports credentials, magic links and Google OAuth".
- [ ] **Step 2:** `git status --short -- CLAUDE.md` must be clean of other agents' edits first. Commit:

```bash
git commit -m "docs: auth supports google oauth only, not github" -- CLAUDE.md
```

---

### Task 7: The manual auth checklist

**Files:**

- Create: `qa/tests/manual/auth-checklist.md`

This is the owner's runbook for what E2E cannot cover: real OAuth, real email, two browsers, the 60 s bridge cache, and the admin-role checks still owed from P-A. Each item has exact steps and the observable result; the owner ticks and dates it.

- [ ] **Step 1: Write the checklist**

```markdown
# Manual auth checks

Run against local (`http://localhost:3000`, Strapi `:1337`) before go-live, then again on the production domain. Tick, date and note anything unexpected. Nothing here prints or stores a secret; use a throwaway Google/GitHub account and a Mailtrap sandbox.

## A. Email delivery (Mailtrap sandbox)

Set `MAILTRAP_USER` / `MAILTRAP_PASS` in `apps/ui/.env.local` (and `EMAIL_FROM` if you want to see the production sender), restart the UI.

- [ ] **Verification.** Register at `/auth/register` with a new address. Mailtrap shows "Confirm your Libraries Global email address" from `EMAIL_FROM`; the link opens `/auth/post-signin` and lands on `/profile/onboarding`.
- [ ] **Password reset.** `/auth/forgot-password` for that address. The email "Reset your Libraries Global password" links to `/auth/reset-password?token=…`; a new password signs in.
- [ ] **Magic link.** `/auth/signin` → "Email me a sign-in link". The email "Your Libraries Global sign-in link" says 5 minutes; the link lands on the destination (or onboarding for a first sign-in). Clicking it a second time shows `/auth/magic-link?error=INVALID_TOKEN` with plain copy.
- [ ] **Unknown address.** Request a magic link for an address with no account: the link's page says there is no account yet (no account is created: `magicLink({ disableSignUp: true })`).

## B. Google OAuth (and GitHub if wired)

Redirect URI registered: `${APP_PUBLIC_URL}/api/auth/callback/google` (`/github`).

- [ ] **New account.** "Sign up with Google" on `/auth/register` with an address that has no account. Lands on `/profile/onboarding`. In Strapi admin, the user-profile exists; in the Better Auth `user` table `termsVersion` equals `TERMS_VERSION` and `termsAcceptedAt` is set (the value came through the OAuth state).
- [ ] **Existing account, verified.** Sign in with Google for an onboarded account: lands on the destination, never onboarding.
- [ ] **Pre-hijack guard.** Register a password account for an address you control but do NOT verify it. Sign in with Google for the same address. Expected: Google sign-in succeeds, and afterwards the password no longer works ("Incorrect email or password") because the unverified credential was dropped before the link.
- [ ] **Callback URL safety.** Start Google sign-in from `/auth/signin?callbackUrl=https://evil.test`. Lands on `/` (or onboarding), never an external site.

## C. Sessions

- [ ] **Two-browser revoke.** Sign in as the same user in browser A and browser B. In A: Settings → Sign-in & security → the B session → "Sign out". Reload B: signed out (`/api/auth/get-session` returns null). "Sign out everywhere else" leaves only A.
- [ ] **Role change within 60 s.** Sign in as `access-librarian@example.test` (see `TEST-USERS.local.md`). In Strapi admin set the profile's `contributorRole` to `reader`. Within 60 s `GET /api/auth/get-session` no longer lists `submit.libraryEdit` in `capabilities`, and `POST /api/submissions` with `submissionType: "library_edit"` is refused by the submission policy. Restore the role (or re-run `pnpm seed:access`).
- [ ] **Sign-out page.** `/auth/signout` ends the session and goes home.

## D. Account deletion

- [ ] Settings → Data & account → type the email → Delete. Lands on `/?deleted=1`; `/api/auth/get-session` is null; the profile page 404s; in Strapi admin the profile's username reads `deleted-<n>` and the email is gone from the users-permissions user. (When Pro payments ship, this must also cancel the subscription and delete the Stripe customer.)

## E. Owed from P-A (`qa/tests/security/pa-regressions.md`)

- [ ] Admin roles: a restricted admin role (not Super Admin) cannot approve submissions or award points; Super Admin can.
- [ ] Preview mode renders draft libraries only with the preview cookie.
- [ ] Live re-runs of A2, A3, A4 and A11 as written there.
```

- [ ] **Step 2: Commit**

```bash
git add qa/tests/manual/auth-checklist.md
git commit -m "docs: manual auth checklist for oauth, email, sessions and deletion" -- qa/tests/manual/auth-checklist.md
```

Then hand the checklist to the owner, with the Mailtrap step first, and record the outcomes in the ledger when they come back.

---

### Task 8: Docs and ledger

**Files:**

- Modify: `CLAUDE.md` (Auth bullets, ~line 50–56)
- Modify: `TODOS.md`
- Modify: `docs/superpowers/handoffs/2026-09-28-pro-auth-contribution-handoff.md` §4 (add "WP1 done" with commits) and §6 WP1 (strike items done)
- Append: `.git/sdd/progress.md`

- [ ] **Step 1:** In `CLAUDE.md`'s Auth section, add a bullet: "Every sign-in path ends on `/auth/post-signin`, which sends a user with a loaded profile and no username to onboarding; magic links use `magicLinkCallbacks` (`lib/auth-redirects.ts`) to get there." Update the OAuth provider list per Task 6.
- [ ] **Step 2:** In `TODOS.md` "Phases done", add WP1 (auth) with a one-line summary; under "Feature backlog", leave 2FA and notification email as they are.
- [ ] **Step 3:** In the handoff §4, add a "WP1: auth and login" block listing the commits and the manual items still owed; in §6 WP1, mark items 1, 4, 7 and 8 done, 2 and 3 "code done; manual checks owed", 5 and 6 "manual / WP2".
- [ ] **Step 4:** `git status --short -- CLAUDE.md TODOS.md docs/superpowers/handoffs/…` must show only your changes, then:

```bash
git commit -m "docs: record wp1 auth work and the manual checks owed" -- CLAUDE.md TODOS.md docs/superpowers/handoffs/2026-09-28-pro-auth-contribution-handoff.md
```

---

## Self-review

**Spec coverage (handoff §6 WP1):**

| Handoff item                                                           | Task                          |
| ---------------------------------------------------------------------- | ----------------------------- |
| 1. Magic link skips onboarding + E2E                                   | 1, 2                          |
| 2. Email delivery (Mailtrap verification, env docs)                    | 5 (code + docs), 7-A (manual) |
| 3. OAuth: GitHub decision, redirect URIs, guard kept, manual checklist | 6, 5-docs, 7-B                |
| 4. Terms and 18+ E2E (UI checkbox, API refusal)                        | 3                             |
| 5. Sessions: two-browser revoke, role revoke ≤ 60 s                    | 7-C                           |
| 6. Account deletion (Stripe part is WP2)                               | 3 (E2E), 7-D                  |
| 7. Accessibility: labels, avatar button, combobox ARIA                 | 4                             |
| 8. E2E funnel register → verify → sign in → onboard → profile          | 3                             |

**Placeholder scan:** none; every code step carries its code. Task 3 has one conditional ("if `GET /api/profile/[username]` doesn't exist") with both branches spelled out.

**Type consistency:** `magicLinkCallbacks` (Task 1) ↔ the literal expected in Task 2; `signInThroughForm(page, email, callbackUrl?)` returns the response and is used that way in Tasks 2 and 3; `completeOnboarding(page, username)` in Tasks 2 and 3; `AvatarUpload` `label` default `"Profile photo"` ↔ the test name `"Profile photo: add a photo"`; `emailTransport().name` ↔ the email test.
