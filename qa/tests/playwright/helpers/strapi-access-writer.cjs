/**
 * Strapi-side half of seed-access-fixtures.ts. LOCAL DEVELOPMENT ONLY.
 *
 * WARNING: this boots a second, headless Strapi instance against the local
 * database, alongside any running `strapi develop`. Before writing anything
 * it refuses production and any non-loopback database host. It also:
 *   - runs apps/strapi/dist, so dist must be up to date (`strapi develop`
 *     rebuilds it on start; run that after pulling or editing Strapi code);
 *   - runs schema sync and the app's (idempotent) bootstrap on load, so it
 *     must never run while a content-type schema is mid-edit.
 *
 * Why it exists: Strapi REST cannot make these writes, by design.
 * user-profile exposes only find/findOne, and library-affiliation,
 * entitlement-grant and pro-verification have no routes at all (P-A
 * hardening; the last two are admin-only). So this calls load() and writes
 * through the Document Service, the same way the moderation service does on
 * claim approval. It never calls listen(), so no HTTP server starts. load()
 * runs bootstrap, which starts the cron service. So the writer:
 *   - sets server.cron.enabled = false before load(), so config/cron-tasks
 *     are never scheduled even if CRON_ENABLED=true in apps/strapi/.env;
 *   - destroys the cron service straight after load(). Core and plugins
 *     add their own jobs with strapi.cron.add whatever that flag says
 *     (telemetry, upload's weekly job, the rewards leaderboard snapshot),
 *     and destroy() stops those. A job due in that instant could still run.
 *
 * Run by the seed with cwd = apps/strapi, so Strapi loads its own .env.
 * Input: ACCESS_SEED_PLAN, a JSON array of { baUserId, role, username,
 * plan, claimLibrary } (see FIXTURES in access-fixtures.ts; a null username
 * marks the onboarding fixture). Output: one line prefixed
 * ACCESS_SEED_RESULT with a JSON summary of what changed.
 *
 * Every fixture converges in both directions: rows it should have are
 * created, rows it shouldn't are deleted, and nothing that already matches
 * is written, so a re-run is a no-op.
 */
const { createRequire } = require("node:module")
const path = require("node:path")

const appDir = process.cwd()
const requireFromStrapi = createRequire(path.join(appDir, "package.json"))
const { createStrapi } = requireFromStrapi("@strapi/strapi")

const PROFILE = "api::user-profile.user-profile"
const AFFILIATION = "api::library-affiliation.library-affiliation"
const GRANT = "api::entitlement-grant.entitlement-grant"
const VERIFICATION = "api::pro-verification.pro-verification"

const DAY_MS = 86_400_000
// pro-verified's verification runs a year. One with under 30 days left is
// replaced, so it never lapses between seeds and a re-run stays a no-op.
const VERIFICATION_DAYS = 365
const VERIFICATION_RENEW_DAYS = 30

/**
 * What onboarding writes: OnboardingShell's handleSave body, less avatarUrl,
 * which the PUT /api/profile/me allowlist drops. The onboarding fixture has
 * them cleared on every run (its username too, in applyProfile), so it
 * onboards from scratch. profileVisibility stays private, like every
 * fixture's.
 */
const ONBOARDING_CLEARED = {
  firstName: null,
  lastName: null,
  pronouns: null,
  bio: null,
  city: null,
  country: null,
  timezone: null,
  affiliationType: null,
  interests: null,
  languages: [],
  website: null,
  orcid: null,
  mastodon: null,
  linkedin: null,
}

/**
 * Rewards standing. pro-earned sits at Archivist (1500 points), the lowest
 * tier that earns Pro; every other fixture starts from zero. Nobody holds
 * the 90-day earned-Pro hold, which only a drop below Archivist sets.
 */
function standing(plan) {
  return plan === "pro-earned"
    ? { points: 1500, tier: "Archivist", earnedProUntil: null }
    : { points: 0, tier: "Reader", earnedProUntil: null }
}

// null, undefined and an empty list all count as cleared.
const isCleared = (v) => v == null || (Array.isArray(v) && v.length === 0)

const matches = (current, target) =>
  isCleared(target) ? isCleared(current) : current === target

// Loopback destinations. 0.0.0.0 is included because the local
// apps/strapi/.env uses DATABASE_HOST=0.0.0.0, which as a destination
// address means "this host".
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"])

function isLocalHost(host) {
  return LOCAL_HOSTS.has(
    String(host)
      .replaceAll(/^\[|\]$/g, "")
      .toLowerCase()
  )
}

/** Hosts a pg connection string points at; never echoes the string itself. */
function hostsFromConnectionString(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error("Refusing: database connectionString is not a valid URL")
  }
  if (url.searchParams.has("host"))
    throw new Error(
      "Refusing: database connectionString has a host= query override"
    )

  return [url.hostname]
}

/**
 * Throws unless this Strapi would write to a local, non-production database.
 * Runs after config is loaded and before load(), so before any DB access.
 */
function assertLocalDatabase(strapi) {
  if (
    strapi.config.get("environment") === "production" ||
    process.env.NODE_ENV === "production"
  )
    throw new Error("Refusing: Strapi environment is production")

  const db = strapi.config.get("database.connection") ?? {}
  const conn = db.connection ?? {}
  if (/sqlite/.test(String(db.client))) {
    if (typeof conn.filename === "string" && conn.filename) return
    throw new Error("Refusing: sqlite database has no file path")
  }

  const hosts = []
  if (conn.host) hosts.push(conn.host)
  if (conn.connectionString)
    hosts.push(...hostsFromConnectionString(conn.connectionString))
  // pg falls back to localhost when neither is set.
  if (hosts.length === 0) hosts.push("localhost")
  if (!hosts.every(isLocalHost))
    throw new Error("Refusing: Strapi database host is not local")
}

async function applyProfile(strapi, item) {
  // No `fields`: every scalar comes back, private earnedProUntil included
  // (the Document Service doesn't sanitise), plus the languages component.
  const [profile] = await strapi.documents(PROFILE).findMany({
    filters: { baUserId: { $eq: item.baUserId } },
    populate: { languages: true },
    limit: 1,
  })
  if (!profile) throw new Error(`No user-profile for ${item.baUserId}`)

  const data = {
    contributorRole: item.role,
    username: item.username,
    profileVisibility: "private",
    // Mirror a real claim approval (grantVerifiedLibrarian): only the
    // claiming fixture is a verified librarian.
    isVerifiedLibrarian: !!item.claimLibrary,
    ...standing(item.plan),
    ...(item.username === null ? ONBOARDING_CLEARED : {}),
  }
  const changed = Object.keys(data).some((k) => !matches(profile[k], data[k]))
  if (changed)
    await strapi
      .documents(PROFILE)
      .update({ documentId: profile.documentId, data })

  return changed
}

/**
 * Converges affiliations: the claiming fixture ends with exactly one, on
 * claimLibrary; every other fixture ends with none.
 */
async function applyClaim(strapi, item) {
  const existing = await strapi.documents(AFFILIATION).findMany({
    filters: { baUserId: { $eq: item.baUserId } },
    populate: { library: { fields: ["documentId"] } },
    limit: 100,
  })
  let kept = false
  let removed = 0
  for (const a of existing) {
    if (
      item.claimLibrary &&
      !kept &&
      a.library?.documentId === item.claimLibrary
    ) {
      kept = true
      continue
    }
    await strapi.documents(AFFILIATION).delete({ documentId: a.documentId })
    removed++
  }
  let created = false
  if (item.claimLibrary && !kept) {
    await strapi.documents(AFFILIATION).create({
      data: {
        baUserId: item.baUserId,
        // Schema enum is email_domain | vouching | contact_us; a moderated
        // (manually reviewed) claim is contact_us, the schema default.
        verificationMethod: "contact_us",
        library: { connect: [{ documentId: item.claimLibrary }] },
      },
    })
    created = true
  }

  return { claimCreated: created, claimsRemoved: removed }
}

/** The one entitlement-grant a fixture's plan wants, or null for none. */
function wantedGrant(plan) {
  if (plan === "pro-grant")
    return { plan: "pro", source: "admin", reason: "access fixture" }
  if (plan === "team-grant")
    return { plan: "team", source: "team", reason: "access fixture" }

  return null
}

/**
 * Converges entitlement-grants: a granted fixture ends with exactly its one
 * unexpiring grant; every other fixture ends with none.
 */
async function applyGrants(strapi, item) {
  const want = wantedGrant(item.plan)
  const existing = await strapi.documents(GRANT).findMany({
    filters: { baUserId: { $eq: item.baUserId } },
    limit: 100,
  })
  let kept = false
  let removed = 0
  for (const g of existing) {
    if (
      want &&
      !kept &&
      g.plan === want.plan &&
      g.source === want.source &&
      g.reason === want.reason &&
      g.expiresAt == null
    ) {
      kept = true
      continue
    }
    await strapi.documents(GRANT).delete({ documentId: g.documentId })
    removed++
  }
  const created = !!want && !kept
  if (created)
    await strapi.documents(GRANT).create({
      data: { baUserId: item.baUserId, ...want, expiresAt: null },
    })

  return { grantCreated: created, grantsRemoved: removed }
}

/**
 * Converges pro-verifications: pro-verified ends with exactly one
 * library_staff verification that has at least VERIFICATION_RENEW_DAYS to
 * run; every other fixture ends with none.
 */
async function applyVerifications(strapi, item, now) {
  const want = item.plan === "pro-verified"
  const existing = await strapi.documents(VERIFICATION).findMany({
    filters: { baUserId: { $eq: item.baUserId } },
    limit: 100,
  })
  let kept = false
  let removed = 0
  for (const v of existing) {
    // A verification with no expiry isn't the fixture's shape: replace it.
    const msLeft = v.expiresAt ? new Date(v.expiresAt).getTime() - now : 0
    if (
      want &&
      !kept &&
      v.kind === "library_staff" &&
      v.verifiedAt != null &&
      msLeft >= VERIFICATION_RENEW_DAYS * DAY_MS
    ) {
      kept = true
      continue
    }
    await strapi.documents(VERIFICATION).delete({ documentId: v.documentId })
    removed++
  }
  const created = want && !kept
  if (created)
    await strapi.documents(VERIFICATION).create({
      data: {
        baUserId: item.baUserId,
        kind: "library_staff",
        verifiedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + VERIFICATION_DAYS * DAY_MS).toISOString(),
      },
    })

  return { verificationCreated: created, verificationsRemoved: removed }
}

/**
 * Every read, update and delete here filters on baUserId, and a missing or
 * empty one could match other users' rows. So a bad plan is refused before
 * Strapi loads. The message names the item's index, never its values.
 */
function assertPlan(plan) {
  if (!Array.isArray(plan))
    throw new Error("Refusing: ACCESS_SEED_PLAN is not a JSON array")
  for (const [i, item] of plan.entries()) {
    const id = item?.baUserId
    if (typeof id !== "string" || id.trim() === "")
      throw new Error(
        `Refusing: plan item ${i} has no baUserId (a non-empty string)`
      )
  }
}

async function main() {
  const plan = JSON.parse(process.env.ACCESS_SEED_PLAN ?? "[]")
  assertPlan(plan)
  const instance = createStrapi({ appDir, distDir: path.join(appDir, "dist") })
  assertLocalDatabase(instance)
  // A second instance must not run scheduled tasks alongside `strapi
  // develop`. Config is loaded in createStrapi(), so this lands before
  // bootstrap reads it.
  instance.config.set("server.cron.enabled", false)
  const strapi = await instance.load()
  // Bootstrap still starts the cron service with the jobs core and plugins
  // added themselves; stop them all.
  strapi.cron?.destroy?.()
  strapi.log.level = "error"
  const result = []
  const now = Date.now()
  try {
    for (const item of plan) {
      const profileChanged = await applyProfile(strapi, item)
      const claim = await applyClaim(strapi, item)
      const grant = await applyGrants(strapi, item)
      const verification = await applyVerifications(strapi, item, now)
      result.push({
        baUserId: item.baUserId,
        profileChanged,
        ...claim,
        ...grant,
        ...verification,
      })
    }
  } finally {
    await strapi.destroy()
  }
  process.stdout.write(`ACCESS_SEED_RESULT ${JSON.stringify(result)}\n`)
}

// Exit explicitly: a Strapi instance that failed mid-load can leave open
// handles (db pool, timers) that would otherwise keep this process alive.
/* eslint-disable unicorn/no-process-exit */
main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(`${error?.stack ?? error}\n`)
    process.exit(1)
  }
)
/* eslint-enable unicorn/no-process-exit */
