/**
 * Seeds one Better Auth user per Contributor Role for the access E2E.
 * Local only: refuses to run in production or against a non-local host.
 *
 * Strapi REST is used for reads only (STRAPI_SEED_TOKEN can be read-only).
 * Writes can't use REST: it exposes no update for user-profile and no routes
 * for library-affiliation (P-A hardening), so they go through the Document
 * Service in a headless Strapi process (strapi-access-writer.cjs).
 *
 * The password comes from ACCESS_FIXTURE_PASSWORD. An existing fixture whose
 * stored credential doesn't match it is reset to it (hashed with the UI's
 * own Better Auth), so changing the value and re-running the seed is enough.
 */
import { execFile } from "node:child_process"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"

import dotenv from "dotenv"
import { Client } from "pg"

import {
  emailFor,
  fixturePassword,
  FIXTURES,
  retryAfterMs,
} from "./access-fixtures"

// The UI caches each user's session profile for 60 s (SESSION_PROFILE_TTL_MS).
const SESSION_CACHE_TTL_MS = 60_000
const STRAPI_APP_DIR = path.resolve(__dirname, "../../../../apps/strapi")
const UI_APP_DIR = path.resolve(__dirname, "../../../../apps/ui")
const WRITER = path.resolve(__dirname, "strapi-access-writer.cjs")
const LOCAL = /^(localhost|127\.0\.0\.1)$/

type PlanItem = {
  email: string
  baUserId: string
  role: string
  username: string
  claimLibrary: string | null
  signedUpNow: boolean
  passwordReset: boolean
}
type WriteResult = {
  baUserId: string
  profileChanged: boolean
  claimCreated: boolean
  claimsRemoved: number
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The sign-up hook creates the profile via the auth-bridge; allow it a moment. */
async function waitForProfile(baUserId: string, email: string): Promise<void> {
  const q = `/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&fields[0]=documentId`
  for (let i = 0; i < 20; i++) {
    const { data } = await strapiGet(q)
    if (data[0]) return
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
        email,
        baUserId,
        role: f.role,
        username: `access_${f.key.replace("-", "_")}`,
        claimLibrary: f.claim ? claimLibrary : null,
        signedUpNow,
        passwordReset,
      })
    }
  } finally {
    await db.end()
  }

  const results = await runWriter(plan)
  let mayBeStale = false
  for (const item of plan) {
    const r = results.find((x) => x.baUserId === item.baUserId)
    if (!r) throw new Error(`Strapi writer skipped ${item.email}`)
    const changed = r.profileChanged || r.claimCreated || r.claimsRemoved > 0
    console.log(
      `${item.email}: ${item.signedUpNow ? "created" : "existing"}, role ${item.role}` +
        `${item.passwordReset ? " (password reset)" : ""}` +
        `${r.profileChanged ? " (updated)" : ""}` +
        `${item.claimLibrary ? `, claim ${r.claimCreated ? "created" : "present"}` : ""}` +
        `${r.claimsRemoved ? `, ${r.claimsRemoved} stray claim(s) removed` : ""}`
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
