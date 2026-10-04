/**
 * Seeds the Better Auth users for the access E2E (FIXTURES): one per
 * Contributor Role, scoped Moderators and editors, an applicant with a track
 * record, one per way of holding a paid plan, and two that haven't onboarded
 * yet. Local only: refuses to run in production or against a non-local host.
 *
 * Strapi REST is used for reads only (STRAPI_SEED_TOKEN can be read-only).
 * Writes can't use REST: it exposes no update for user-profile and no routes
 * for role-grant, library-affiliation, entitlement-grant or
 * pro-verification (P-A hardening), so they go through the Document Service
 * in a headless Strapi process (strapi-access-writer.cjs). Contributor Roles
 * are Role Grants; Strapi derives `contributorRole` from them, and the seed
 * never writes it.
 *
 * The password comes from ACCESS_FIXTURE_PASSWORD. An existing fixture whose
 * stored credential doesn't match it is reset to it (hashed with the UI's
 * own Better Auth), so changing the value and re-running the seed is enough.
 *
 * A re-run changes nothing that already matches. What the specs change, the
 * next seed undoes: the onboarding fixture's username is cleared again, the
 * wiki_editor grant an approved Role Application gave the applicant is
 * removed, and every submission the specs created is deleted (the
 * applicant's five accepted ones stay). It also adds any locale the fixture
 * grants name (fr) to Strapi's i18n plugin if it's missing.
 */
import { execFile } from "node:child_process"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"

import dotenv from "dotenv"
import { Client } from "pg"

import {
  derivedRole,
  emailFor,
  type FixtureGrant,
  FIXTURE_LOCALES,
  type FixturePlan,
  fixturePassword,
  FIXTURES,
  retryAfterMs,
  sleep,
} from "./access-fixtures"
// Sign-up is refused without the current terms version, so read the UI's own
// constant rather than a copy that could drift.
import { TERMS_VERSION } from "../../../../apps/ui/src/lib/legal-consent"

// The UI caches each user's session profile for 60 s (SESSION_PROFILE_TTL_MS).
const SESSION_CACHE_TTL_MS = 60_000
const STRAPI_APP_DIR = path.resolve(__dirname, "../../../../apps/strapi")
const UI_APP_DIR = path.resolve(__dirname, "../../../../apps/ui")
const WRITER = path.resolve(__dirname, "strapi-access-writer.cjs")
const LOCAL = /^(localhost|127\.0\.0\.1)$/

type PlanItem = {
  key: string
  email: string
  baUserId: string
  /** The derived Contributor Role the grants give, for the log line. */
  role: string
  roleGrants: readonly FixtureGrant[]
  /** null for the onboarding fixture, which the writer resets. */
  username: string | null
  plan: FixturePlan | null
  claimLibrary: string | null
  trackRecord: number
  signedUpNow: boolean
  passwordReset: boolean
}
type WriteResult = {
  baUserId: string
  profileChanged: boolean
  /** The derived contributorRole changed (a grant write or a resync). */
  roleChanged: boolean
  roleGrantsCreated: number
  roleGrantsRemoved: number
  claimCreated: boolean
  claimsRemoved: number
  grantCreated: boolean
  grantsRemoved: number
  verificationCreated: boolean
  verificationsRemoved: number
  submissionsCreated: number
  submissionsRemoved: number
}
type WriterOutput = {
  fixtures: WriteResult[]
  localesCreated: string[]
}

function assertLocal(): void {
  if (process.env.NODE_ENV === "production")
    throw new Error("Refusing: production")
  for (const v of ["BASE_URL", "STRAPI_URL", "BA_DATABASE_URL"]) {
    const raw = process.env[v]
    if (!raw) throw new Error(`Missing ${v}`)
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      // Never echo the value: BA_DATABASE_URL carries a password.
      throw new Error(`Invalid ${v}`)
    }
    if (!LOCAL.test(url.hostname))
      throw new Error(`Refusing: ${v} is not local`)
    // pg lets ?host= override the URL's host, which would bypass the check.
    if (v === "BA_DATABASE_URL" && url.searchParams.has("host"))
      throw new Error("Refusing: BA_DATABASE_URL has a host= query override")
  }
  if (!process.env.STRAPI_SEED_TOKEN)
    throw new Error("Missing STRAPI_SEED_TOKEN")
}

/** Strapi REST reads (GET only). */
async function strapiGet(pathAndQuery: string) {
  const res = await fetch(`${process.env.STRAPI_URL}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${process.env.STRAPI_SEED_TOKEN}` },
  })
  if (!res.ok)
    throw new Error(`GET ${pathAndQuery} → ${res.status} ${await res.text()}`)

  return res.json()
}

/** The sign-up hook creates the profile via the auth-bridge; allow it a moment. */
async function waitForProfile(baUserId: string, email: string): Promise<void> {
  // baUserId is private, so the profile is read through the bridge-only
  // own-profile route rather than a public filter.
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) throw new Error("STRAPI_BRIDGE_SECRET is required to seed")
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${process.env.STRAPI_URL}/api/user-profiles/me`, {
      headers: { "X-Service-Secret": secret, "X-Ba-User-Id": baUserId },
    })
    if (res.ok) return
    await sleep(500)
  }
  throw new Error(`No user-profile for ${email}; sign-up sync failed`)
}

/**
 * Returns true if this call created the user. Better Auth limits sign-up to
 * 3 per minute per IP, so a 429 is waited out rather than treated as failure.
 */
const SIGN_UP_ATTEMPTS = 3

async function signUp(
  email: string,
  key: string,
  password: string
): Promise<boolean> {
  for (let attempt = 1; attempt <= SIGN_UP_ATTEMPTS; attempt++) {
    const res = await fetch(`${process.env.BASE_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.BASE_URL!,
      },
      body: JSON.stringify({
        email,
        password,
        name: `Access ${key}`,
        termsVersion: TERMS_VERSION,
      }),
    })
    if (res.ok) return true
    // An existing user returns 422 and is reused.
    if (res.status === 422) return false
    if (res.status !== 429)
      throw new Error(`sign-up ${email} → ${res.status} ${await res.text()}`)
    if (attempt === SIGN_UP_ATTEMPTS) break
    const wait = retryAfterMs(res.headers.get("x-retry-after"))
    console.log(
      `sign-up rate-limited; retrying in ${Math.round(wait / 1000)} s`
    )
    await sleep(wait)
  }
  throw new Error(`sign-up ${email} still rate-limited`)
}

type PasswordHasher = {
  hashPassword: (password: string) => Promise<string>
  verifyPassword: (data: { hash: string; password: string }) => Promise<boolean>
}

/** Better Auth's own hasher, resolved from the UI app, so hashes match sign-in. */
async function loadPasswordHasher(): Promise<PasswordHasher> {
  const fromUi = createRequire(path.join(UI_APP_DIR, "package.json"))

  return import(pathToFileURL(fromUi.resolve("better-auth/crypto")).href)
}

/**
 * Sets an existing fixture's credential to `password` if it doesn't already
 * match. Only touches the credential row of this one fixture user.
 */
async function convergePassword(
  db: Client,
  hasher: PasswordHasher,
  baUserId: string,
  email: string,
  password: string
): Promise<boolean> {
  const { rows } = await db.query<{ id: string; password: string | null }>(
    `SELECT id, password FROM "account" WHERE "userId" = $1 AND "providerId" = 'credential'`,
    [baUserId]
  )
  if (!rows[0]) throw new Error(`No password credential for ${email}`)
  const { id, password: hash } = rows[0]
  if (hash && (await hasher.verifyPassword({ hash, password }))) return false
  await db.query(
    `UPDATE "account" SET password = $1, "updatedAt" = now() WHERE id = $2`,
    [await hasher.hashPassword(password), id]
  )

  return true
}

async function runWriter(plan: PlanItem[]): Promise<WriterOutput> {
  const { stdout } = await promisify(execFile)(process.execPath, [WRITER], {
    cwd: STRAPI_APP_DIR,
    // Minimal env: Strapi must read its own apps/strapi/.env, not ours.
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      ACCESS_SEED_PLAN: JSON.stringify(
        plan.map((item) => ({
          baUserId: item.baUserId,
          email: item.email,
          name: `Access ${item.key}`,
          roleGrants: item.roleGrants.map((g) => ({
            role: g.role,
            queue: g.queue ?? "all",
            locale: g.locale ?? null,
          })),
          username: item.username,
          plan: item.plan,
          claimLibrary: item.claimLibrary,
          trackRecord: item.trackRecord,
        }))
      ),
      ACCESS_SEED_OPTIONS: JSON.stringify({
        locales: FIXTURE_LOCALES,
      }),
    },
    maxBuffer: 16 * 1024 * 1024,
  })
  const line = stdout
    .split("\n")
    .find((l) => l.startsWith("ACCESS_SEED_RESULT "))
  if (!line) throw new Error(`Strapi writer gave no result:\n${stdout}`)

  return JSON.parse(line.slice("ACCESS_SEED_RESULT ".length))
}

const createdOrPresent = (created: boolean) => (created ? "created" : "present")

/** One line per fixture: its state, and what this run changed. */
function describeResult(item: PlanItem, r: WriteResult): string {
  const head =
    `${item.signedUpNow ? "created" : "existing"}, role ${item.role}` +
    `${r.roleChanged ? " (re-derived)" : ""}` +
    `${item.passwordReset ? " (password reset)" : ""}` +
    `${r.profileChanged ? " (updated)" : ""}`
  const granted = item.plan === "pro-grant" || item.plan === "team-grant"
  const notes: [boolean, string][] = [
    [
      item.username === null,
      `onboarding ${r.profileChanged ? "reset" : "pending"}`,
    ],
    [item.claimLibrary !== null, `claim ${createdOrPresent(r.claimCreated)}`],
    [granted, `grant ${createdOrPresent(r.grantCreated)}`],
    [
      item.plan === "pro-verified",
      `verification ${createdOrPresent(r.verificationCreated)}`,
    ],
    [
      item.roleGrants.length > 0,
      `${item.roleGrants.length} role grant(s)${r.roleGrantsCreated > 0 ? `, ${r.roleGrantsCreated} created` : ""}`,
    ],
    [
      r.roleGrantsRemoved > 0,
      `${r.roleGrantsRemoved} stray role grant(s) removed`,
    ],
    [
      item.trackRecord > 0,
      `${item.trackRecord} accepted submission(s)${r.submissionsCreated > 0 ? `, ${r.submissionsCreated} created` : ""}`,
    ],
    [
      r.submissionsRemoved > 0,
      `${r.submissionsRemoved} earlier submission(s) removed`,
    ],
    [r.claimsRemoved > 0, `${r.claimsRemoved} stray claim(s) removed`],
    [r.grantsRemoved > 0, `${r.grantsRemoved} stray grant(s) removed`],
    [
      r.verificationsRemoved > 0,
      `${r.verificationsRemoved} stray verification(s) removed`,
    ],
  ]
  const shown = notes.filter(([on]) => on).map(([, text]) => text)

  return `${item.email}: ${[head, `plan ${item.plan ?? "free"}`, ...shown].join(", ")}`
}

export async function seedAccessFixtures(): Promise<void> {
  assertLocal()
  const password = fixturePassword()
  const hasher = await loadPasswordHasher()
  const db = new Client({ connectionString: process.env.BA_DATABASE_URL })
  await db.connect()
  const plan: PlanItem[] = []
  try {
    const { data: libs } = await strapiGet(
      "/api/libraries?pagination[pageSize]=1&sort[0]=id:asc&fields[0]=documentId"
    )
    if (!libs?.[0]?.documentId)
      throw new Error("No libraries to claim: Strapi has no published library")
    const claimLibrary: string = libs[0].documentId

    for (const f of FIXTURES) {
      const email = emailFor(f.key)
      // Skip sign-up for users that already exist: it spends rate budget.
      const { rowCount } = await db.query(
        `SELECT 1 FROM "user" WHERE email = $1`,
        [email]
      )
      const signedUpNow = rowCount
        ? false
        : await signUp(email, f.key, password)
      const { rows } = await db.query(
        `UPDATE "user" SET "emailVerified" = true WHERE email = $1 RETURNING id`,
        [email]
      )
      if (!rows[0]) throw new Error(`No Better Auth user for ${email}`)
      const baUserId: string = rows[0].id
      // A user that already existed (sign-up 422) may predate the password.
      const passwordReset = signedUpNow
        ? false
        : await convergePassword(db, hasher, baUserId, email, password)
      await waitForProfile(baUserId, email)
      plan.push({
        key: f.key,
        email,
        baUserId,
        role: derivedRole(f.grants),
        roleGrants: f.grants,
        username:
          f.username === null ? null : `access_${f.key.replaceAll("-", "_")}`,
        plan: f.plan ?? null,
        claimLibrary: f.claim ? claimLibrary : null,
        trackRecord: f.trackRecord ?? 0,
        signedUpNow,
        passwordReset,
      })
    }
  } finally {
    await db.end()
  }

  const output = await runWriter(plan)
  for (const code of output.localesCreated)
    console.log(`Strapi locale ${code} added (fixture grants name it)`)
  let mayBeStale = false
  for (const item of plan) {
    const r = output.fixtures.find((x) => x.baUserId === item.baUserId)
    if (!r) throw new Error(`Strapi writer skipped ${item.email}`)
    // Only what the session profile reads counts; submissions don't.
    const changed =
      r.profileChanged ||
      r.roleChanged ||
      r.roleGrantsCreated > 0 ||
      r.roleGrantsRemoved > 0 ||
      r.claimCreated ||
      r.claimsRemoved > 0 ||
      r.grantCreated ||
      r.grantsRemoved > 0 ||
      r.verificationCreated ||
      r.verificationsRemoved > 0
    console.log(describeResult(item, r))
    // A user created in this run has never had a session read, so nothing
    // is cached for them. An existing one might, and the cache only expires.
    if (changed && !item.signedUpNow) mayBeStale = true
  }
  if (mayBeStale) {
    console.log("existing fixture changed; waiting out the 60 s session cache")
    await sleep(SESSION_CACHE_TTL_MS + 1000)
  }
}

if (require.main === module) {
  dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true })
  // CommonJS entry point (require.main), so no top-level await here.
  // eslint-disable-next-line unicorn/prefer-top-level-await
  seedAccessFixtures().then(
    () => console.log("access fixtures seeded"),
    (error) => {
      console.error(error)
      process.exitCode = 1
    }
  )
}
