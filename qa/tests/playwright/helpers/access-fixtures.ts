/**
 * Fixtures and helpers shared by the access seed and the access specs. Keep
 * this module free of side-effecting imports (pg, dotenv, child_process) so
 * a spec can import it without pulling in the seed's machinery. The
 * Playwright imports are type-only, so the seed never loads Playwright.
 */
import type {
  APIRequest,
  APIRequestContext,
  APIResponse,
  Browser,
  Page,
} from "@playwright/test"

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

/** A Contributor Role that can be granted (`reader` is "no grants"). */
export type GrantableRole =
  | "contributor"
  | "verified_librarian"
  | "wiki_editor"
  | "journal_editor"
  | "moderator"
  | "editorial_board"

export type ModerationQueue =
  | "all"
  | "index"
  | "knowledge"
  | "journal"
  | "applications"

/**
 * One Role Grant, written by the seed as `{ role, queue, scopeLocale }`
 * with source `admin` and no expiry.
 */
export type FixtureGrant = {
  role: GrantableRole
  /** Only meaningful for `moderator`. Default `all`. */
  queue?: ModerationQueue
  /** Absent or null: every locale. */
  locale?: string | null
}

export type Fixture = {
  key: string
  /**
   * The fixture's Role Grants; none means reader. The seed converges them
   * exactly, and Strapi derives `user-profile.contributorRole` from them.
   * Plans never change them: money never buys trust.
   */
  grants: readonly FixtureGrant[]
  /** Holds one approved library claim (a library-affiliation). */
  claim: boolean
  plan?: FixturePlan
  /**
   * null: every seed clears the username and the fields onboarding writes,
   * so signing in lands on onboarding. Absent: the seed sets `access_<key>`.
   */
  username?: null
  /**
   * Approved submissions the seed keeps on record, a track record for a
   * Role Application (which needs 5). Every other submission a fixture
   * holds, these included for fixtures without one, is deleted on each
   * seed, so the specs' submissions never pile up against the quotas.
   */
  trackRecord?: number
}

/** Global (every queue, every locale) grant of `role`. */
const holds = (role: GrantableRole): readonly FixtureGrant[] => [{ role }]

export const FIXTURES: readonly Fixture[] = [
  { key: "reader", grants: [], claim: false },
  // Also the specs' submitter (moderation, location requests).
  { key: "contributor", grants: holds("contributor"), claim: false },
  { key: "librarian", grants: holds("verified_librarian"), claim: true },
  { key: "wiki-editor", grants: holds("wiki_editor"), claim: false },
  { key: "journal-editor", grants: holds("journal_editor"), claim: false },
  { key: "editorial", grants: holds("editorial_board"), claim: false },
  {
    key: "moderator-global",
    grants: [{ role: "moderator", queue: "all", locale: null }],
    claim: false,
  },
  {
    key: "moderator-knowledge-fr",
    grants: [{ role: "moderator", queue: "knowledge", locale: "fr" }],
    claim: false,
  },
  {
    key: "journal-editor-fr",
    grants: [{ role: "journal_editor", queue: "all", locale: "fr" }],
    claim: false,
  },
  // Five accepted changes, so it may apply for an editor role
  // (role-application.spec.ts). Approval gives it a wiki_editor grant,
  // which the next seed removes again.
  {
    key: "applicant",
    grants: holds("contributor"),
    claim: false,
    trackRecord: 5,
  },
  { key: "onboarding", grants: [], claim: false, username: null },
  // Never onboarded, like `onboarding`, but only signed in by magic link
  // (magic-link.spec.ts), which leaves it un-onboarded, so it needs no reset.
  { key: "magic-link", grants: [], claim: false, username: null },
  { key: "pro-grant", grants: [], claim: false, plan: "pro-grant" },
  { key: "pro-earned", grants: [], claim: false, plan: "pro-earned" },
  { key: "pro-verified", grants: [], claim: false, plan: "pro-verified" },
  { key: "team", grants: [], claim: false, plan: "team-grant" },
]

/** Contributor Roles, lowest first (`CONTRIBUTOR_ROLES` in @repo/access). */
const ROLE_ORDER = [
  "reader",
  "contributor",
  "verified_librarian",
  "wiki_editor",
  "journal_editor",
  "moderator",
  "editorial_board",
] as const
export type ContributorRole = (typeof ROLE_ORDER)[number]

/**
 * The `contributorRole` Strapi derives from these grants: the highest one,
 * or reader without any.
 */
export function derivedRole(grants: readonly FixtureGrant[]): ContributorRole {
  let best = 0
  for (const g of grants) best = Math.max(best, ROLE_ORDER.indexOf(g.role))

  return ROLE_ORDER[best]!
}

export const fixtureByKey = (key: string): Fixture => {
  const f = FIXTURES.find((x) => x.key === key)
  if (!f) throw new Error(`No access fixture "${key}"`)

  return f
}

/**
 * Locales the fixtures' grants name. The seed adds any that Strapi's i18n
 * plugin lacks, so a French Moderator has French submissions to review.
 */
export const FIXTURE_LOCALES: readonly string[] = [
  ...new Set(
    FIXTURES.flatMap((f) =>
      f.grants.flatMap((g) => (g.locale ? [g.locale] : []))
    )
  ),
]

/**
 * Areas created by location-request.spec.ts are named with this prefix,
 * and every seed deletes them again.
 */
export const E2E_AREA_PREFIX = "Access E2E area "

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

// ---------------------------------------------------------------------------
// Spec helpers. Each takes the Playwright objects it needs as arguments, so
// this module still imports Playwright for types only.
// ---------------------------------------------------------------------------

/** A new API context signed in as `key`; its cookie jar holds the session. */
export async function signedInApi(
  request: APIRequest,
  baseURL: string,
  key: string
): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL })
  const res = await signIn(api, baseURL, key)
  if (!res.ok()) {
    await api.dispose()
    throw new Error(
      `Sign-in for ${emailFor(key)} failed (${res.status()}). Run \`pnpm seed:access\`.`
    )
  }

  return api
}

/**
 * A browser page signed in as `api`'s user, from its cookies: no second
 * sign-in, so no second spend of Better Auth's 5-a-minute budget. The
 * caller closes `page.context()`.
 */
export async function pageAs(
  browser: Browser,
  api: APIRequestContext,
  baseURL: string
): Promise<Page> {
  const context = await browser.newContext({
    baseURL,
    storageState: await api.storageState(),
  })

  return context.newPage()
}

/** The session fields the access specs read. */
export type SessionUser = {
  id: string
  profileLoaded: boolean
  contributorRole: string
  capabilities: string[]
  moderationScopes: { queue: string; locale: string | null }[]
  editorLocales: { docs: "all" | string[]; journal: "all" | string[] }
}

export async function sessionOf(
  api: APIRequestContext
): Promise<SessionUser | null> {
  const res = await api.get("/api/auth/get-session")

  return ((await res.json()) as { user?: SessionUser } | null)?.user ?? null
}

/** Throws unless the session loaded its profile (Strapi is reachable). */
export async function loadedSession(
  api: APIRequestContext,
  key: string
): Promise<SessionUser> {
  const user = await sessionOf(api)
  if (user?.profileLoaded !== true)
    throw new Error(
      `The session profile for ${emailFor(key)} didn't load. Is Strapi running?`
    )

  return user
}

/** Strapi's error message from a JSON error body, if any. */
async function errorMessage(res: APIResponse): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: unknown } | string
  } | null
  const e = body?.error

  return typeof e === "string" ? e : String(e?.message ?? "")
}

/**
 * Creates a submission through the UI's `/api/submissions` (which forwards
 * to Strapi as the signed-in user) and returns its documentId.
 */
export async function submit(
  api: APIRequestContext,
  body: Record<string, unknown>
): Promise<string> {
  const res = await api.post("/api/submissions", { data: body })
  if (!res.ok())
    throw new Error(
      `POST /api/submissions (${String(body.submissionType)}) → ${res.status()} ${await errorMessage(res)}`
    )
  const documentId = ((await res.json()) as { data?: { documentId?: unknown } })
    .data?.documentId
  if (typeof documentId !== "string")
    throw new Error("POST /api/submissions returned no documentId")

  return documentId
}

export type MySubmission = {
  documentId: string
  submissionType: string
  status: string
  reviewNote?: string | null
  locale?: string
  fields?: Record<string, unknown> | null
}

/** The signed-in user's own submissions (`/api/submissions/my`). */
export async function mySubmissions(
  api: APIRequestContext
): Promise<MySubmission[]> {
  const res = await api.get("/api/submissions/my")
  if (!res.ok()) throw new Error(`GET /api/submissions/my → ${res.status()}`)

  return ((await res.json()) as { data?: MySubmission[] }).data ?? []
}

/** A Moderator's decision through `/api/moderation`. */
export function decide(
  api: APIRequestContext,
  documentId: string,
  body: { status: "approved" | "rejected" | "needs_info"; note?: string }
): Promise<APIResponse> {
  return api.put(
    `/api/moderation/submissions/${encodeURIComponent(documentId)}/status`,
    { data: body }
  )
}

/**
 * The documentIds of every queue row the Moderator sees for `params`
 * (`status`, `q`, ...), across pages.
 */
export async function queueIds(
  api: APIRequestContext,
  params: Record<string, string>
): Promise<string[]> {
  const ids: string[] = []
  for (let page = 1; page <= 20; page++) {
    const query = new URLSearchParams({
      ...params,
      page: String(page),
      pageSize: "50",
    })
    const res = await api.get(`/api/moderation/submissions?${query}`)
    if (!res.ok())
      throw new Error(`GET /api/moderation/submissions → ${res.status()}`)
    const { data = [], meta } = (await res.json()) as {
      data?: { documentId: string }[]
      meta?: { total?: number }
    }
    ids.push(...data.map((r) => r.documentId))
    if (data.length === 0 || ids.length >= Number(meta?.total ?? 0)) break
  }

  return ids
}

/**
 * A read from Strapi's REST API with the seed's read-only token (qa .env:
 * STRAPI_URL, STRAPI_SEED_TOKEN), to check what is published.
 */
export async function strapiRead<T>(pathAndQuery: string): Promise<T> {
  const base = process.env.STRAPI_URL
  const token = process.env.STRAPI_SEED_TOKEN
  if (!base || !token)
    throw new Error("Set STRAPI_URL and STRAPI_SEED_TOKEN in qa .env")
  const res = await fetch(`${base}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Strapi GET ${pathAndQuery} → ${res.status}`)

  return (await res.json()) as T
}
