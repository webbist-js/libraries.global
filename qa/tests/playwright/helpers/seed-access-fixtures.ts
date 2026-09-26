/**
 * Seeds one Better Auth user per Contributor Role for the access E2E.
 * Local only: refuses to run in production or against a non-local host.
 *
 * Reads go through Strapi REST with STRAPI_SEED_TOKEN. Writes can't: REST
 * exposes no update for user-profile and no routes for library-affiliation
 * (P-A hardening), so they go through the Document Service in a headless
 * Strapi process (strapi-access-writer.cjs).
 */
import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"

import dotenv from "dotenv"
import { Client } from "pg"

export const FIXTURE_PASSWORD = "Access-fixture-2026!"
export const FIXTURES = [
  { key: "reader", role: "reader", claim: false },
  { key: "contributor", role: "contributor", claim: false },
  { key: "librarian", role: "verified_librarian", claim: true },
  { key: "wiki-editor", role: "wiki_editor", claim: false },
  { key: "editorial", role: "editorial_board", claim: false },
] as const
export const emailFor = (key: string) => `access-${key}@example.test`

// The UI caches each user's session profile for 60 s (SESSION_PROFILE_TTL_MS).
const SESSION_CACHE_TTL_MS = 60_000
const STRAPI_APP_DIR = path.resolve(__dirname, "../../../../apps/strapi")
const WRITER = path.resolve(__dirname, "strapi-access-writer.cjs")
const LOCAL = /^(localhost|127\.0\.0\.1)$/

type PlanItem = {
  email: string
  baUserId: string
  role: string
  username: string
  claimLibrary: string | null
  signedUpNow: boolean
}
type WriteResult = {
  baUserId: string
  profileChanged: boolean
  claimCreated: boolean
}

function assertLocal(): void {
  if (process.env.NODE_ENV === "production")
    throw new Error("Refusing: production")
  for (const v of ["BASE_URL", "STRAPI_URL", "BA_DATABASE_URL"]) {
    const raw = process.env[v]
    if (!raw) throw new Error(`Missing ${v}`)
    if (!LOCAL.test(new URL(raw).hostname))
      throw new Error(`Refusing: ${v} is not local`)
  }
  if (!process.env.STRAPI_SEED_TOKEN)
    throw new Error("Missing STRAPI_SEED_TOKEN")
}

async function strapi(pathAndQuery: string, init: RequestInit = {}) {
  const res = await fetch(`${process.env.STRAPI_URL}${pathAndQuery}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.STRAPI_SEED_TOKEN}`,
      ...init.headers,
    },
  })
  if (!res.ok)
    throw new Error(
      `${init.method ?? "GET"} ${pathAndQuery} → ${res.status} ${await res.text()}`
    )

  return res.json()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The sign-up hook creates the profile via the auth-bridge; allow it a moment. */
async function waitForProfile(baUserId: string, email: string): Promise<void> {
  const q = `/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&fields[0]=documentId`
  for (let i = 0; i < 20; i++) {
    const { data } = await strapi(q)
    if (data[0]) return
    await sleep(500)
  }
  throw new Error(`No user-profile for ${email}; sign-up sync failed`)
}

/** Wait time for a Better Auth 429, from its X-Retry-After seconds (cap 65). */
export function retryAfterMs(header: string | null | undefined): number {
  const s = Number(header)

  return (Number.isFinite(s) && s > 0 ? Math.min(s, 65) : 60) * 1000 + 500
}

/**
 * Returns true if this call created the user. Better Auth limits sign-up to
 * 3 per minute per IP, so a 429 is waited out rather than treated as failure.
 */
async function signUp(email: string, key: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${process.env.BASE_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.BASE_URL!,
      },
      body: JSON.stringify({
        email,
        password: FIXTURE_PASSWORD,
        name: `Access ${key}`,
      }),
    })
    if (res.ok) return true
    // An existing user returns 422 and is reused.
    if (res.status === 422) return false
    if (res.status !== 429)
      throw new Error(`sign-up ${email} → ${res.status} ${await res.text()}`)
    const wait = retryAfterMs(res.headers.get("x-retry-after"))
    console.log(
      `sign-up rate-limited; retrying in ${Math.round(wait / 1000)} s`
    )
    await sleep(wait)
  }
  throw new Error(`sign-up ${email} still rate-limited`)
}

async function runWriter(plan: PlanItem[]): Promise<WriteResult[]> {
  const { stdout } = await promisify(execFile)(process.execPath, [WRITER], {
    cwd: STRAPI_APP_DIR,
    // Minimal env: Strapi must read its own apps/strapi/.env, not ours.
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      ACCESS_SEED_PLAN: JSON.stringify(
        plan.map(({ baUserId, role, username, claimLibrary }) => ({
          baUserId,
          role,
          username,
          claimLibrary,
        }))
      ),
    },
    maxBuffer: 16 * 1024 * 1024,
  })
  const line = stdout
    .split("\n")
    .find((l) => l.startsWith("ACCESS_SEED_RESULT "))
  if (!line) throw new Error(`Strapi writer gave no result:\n${stdout}`)

  return JSON.parse(line.slice("ACCESS_SEED_RESULT ".length))
}

export async function seedAccessFixtures(): Promise<void> {
  assertLocal()
  const db = new Client({ connectionString: process.env.BA_DATABASE_URL })
  await db.connect()
  const plan: PlanItem[] = []
  try {
    const { data: libs } = await strapi(
      "/api/libraries?pagination[pageSize]=1&sort[0]=id:asc&fields[0]=documentId"
    )
    const claimLibrary: string = libs[0].documentId

    for (const f of FIXTURES) {
      const email = emailFor(f.key)
      // Skip sign-up for users that already exist: it spends rate budget.
      const { rowCount } = await db.query(
        `SELECT 1 FROM "user" WHERE email = $1`,
        [email]
      )
      const signedUpNow = rowCount ? false : await signUp(email, f.key)
      const { rows } = await db.query(
        `UPDATE "user" SET "emailVerified" = true WHERE email = $1 RETURNING id`,
        [email]
      )
      if (!rows[0]) throw new Error(`No Better Auth user for ${email}`)
      const baUserId: string = rows[0].id
      await waitForProfile(baUserId, email)
      plan.push({
        email,
        baUserId,
        role: f.role,
        username: `access_${f.key.replace("-", "_")}`,
        claimLibrary: f.claim ? claimLibrary : null,
        signedUpNow,
      })
    }
  } finally {
    await db.end()
  }

  const results = await runWriter(plan)
  let mayBeStale = false
  for (const item of plan) {
    const r = results.find((x) => x.baUserId === item.baUserId)
    const changed = !!r && (r.profileChanged || r.claimCreated)
    console.log(
      `${item.email}: ${item.signedUpNow ? "created" : "existing"}, role ${item.role}` +
        `${r?.profileChanged ? " (updated)" : ""}` +
        `${item.claimLibrary ? `, claim ${r?.claimCreated ? "created" : "present"}` : ""}`
    )
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
