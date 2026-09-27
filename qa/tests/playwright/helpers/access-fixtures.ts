/**
 * Fixtures and helpers shared by the access seed and the access specs. Keep
 * this module free of side-effecting imports (pg, dotenv, child_process) so
 * a spec can import it without pulling in the seed's machinery. The
 * Playwright import is type-only, so the seed never loads Playwright.
 */
import type { APIRequestContext } from "@playwright/test"

/**
 * The fixture users' password, from ACCESS_FIXTURE_PASSWORD (qa .env). No
 * default: a password committed to the repo would sign in to any database
 * the fixtures were ever seeded into. Read lazily so importing this module
 * never throws.
 */
export function fixturePassword(): string {
  const password = process.env.ACCESS_FIXTURE_PASSWORD
  if (!password)
    throw new Error(
      "ACCESS_FIXTURE_PASSWORD is not set. Add it to qa/tests/playwright/.env " +
        "(see .env.example), then run `pnpm seed:access`."
    )

  return password
}

/**
 * How a fixture holds a paid plan. The Strapi writer converges exactly this
 * route and removes every other one, so a fixture without a plan is free:
 * no grants, no verifications, 0 points, tier Reader, no earned-Pro hold.
 */
export type FixturePlan =
  /** One entitlement-grant: pro, source admin, no expiry. */
  | "pro-grant"
  /** 1500 points and tier Archivist, the lowest tier that earns Pro. */
  | "pro-earned"
  /** One pro-verification: library_staff, verified now, for a year. */
  | "pro-verified"
  /** One entitlement-grant: team, source team, no expiry. */
  | "team-grant"

export type Fixture = {
  key: string
  /** Contributor Role. Plans never change it: money never buys trust. */
  role:
    | "reader"
    | "contributor"
    | "verified_librarian"
    | "wiki_editor"
    | "editorial_board"
  /** Holds one approved library claim (a library-affiliation). */
  claim: boolean
  plan?: FixturePlan
  /**
   * null: every seed clears the username and the fields onboarding writes,
   * so signing in lands on onboarding. Absent: the seed sets `access_<key>`.
   */
  username?: null
}

export const FIXTURES: readonly Fixture[] = [
  { key: "reader", role: "reader", claim: false },
  { key: "contributor", role: "contributor", claim: false },
  { key: "librarian", role: "verified_librarian", claim: true },
  { key: "wiki-editor", role: "wiki_editor", claim: false },
  { key: "editorial", role: "editorial_board", claim: false },
  { key: "onboarding", role: "reader", claim: false, username: null },
  { key: "pro-grant", role: "reader", claim: false, plan: "pro-grant" },
  { key: "pro-earned", role: "reader", claim: false, plan: "pro-earned" },
  { key: "pro-verified", role: "reader", claim: false, plan: "pro-verified" },
  { key: "team", role: "reader", claim: false, plan: "team-grant" },
]

export const emailFor = (key: string) => `access-${key}@example.test`

/** Wait time for a Better Auth 429, from its X-Retry-After seconds (cap 65). */
export function retryAfterMs(header: string | null | undefined): number {
  const s = Number(header)

  return (Number.isFinite(s) && s > 0 ? Math.min(s, 65) : 60) * 1000 + 500
}

export const SIGN_IN_ATTEMPTS = 3

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Signs `key` in on `api`, whose cookie jar then holds the session. Better
 * Auth allows 5 email sign-ins per minute per IP, so a 429 is waited out and
 * retried rather than treated as a failure.
 */
export async function signIn(
  api: APIRequestContext,
  baseURL: string,
  key: string
) {
  for (let attempt = 1; attempt <= SIGN_IN_ATTEMPTS; attempt++) {
    const res = await api.post("/api/auth/sign-in/email", {
      data: { email: emailFor(key), password: fixturePassword() },
      headers: { Origin: baseURL },
    })
    if (res.status() !== 429) return res
    if (attempt === SIGN_IN_ATTEMPTS) break
    await sleep(retryAfterMs(res.headers()["x-retry-after"]))
  }
  throw new Error(`sign-in for ${key} stayed rate-limited`)
}
