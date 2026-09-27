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
 * user-profile exposes only find/findOne, and library-affiliation has no
 * routes at all (P-A hardening). So this calls load() and writes through
 * the Document Service, the same way the moderation service does on claim
 * approval. It never calls listen(), so no HTTP server starts. load() does
 * run bootstrap, which schedules and starts config/cron-tasks; the writer
 * destroys the cron service straight after load() so no task can fire
 * during the writes (a task due in that instant could still start).
 *
 * Run by the seed with cwd = apps/strapi, so Strapi loads its own .env.
 * Input: ACCESS_SEED_PLAN (JSON array). Output: one line prefixed
 * ACCESS_SEED_RESULT with a JSON summary of what changed.
 */
const { createRequire } = require("node:module")
const path = require("node:path")

const appDir = process.cwd()
const requireFromStrapi = createRequire(path.join(appDir, "package.json"))
const { createStrapi } = requireFromStrapi("@strapi/strapi")

const PROFILE = "api::user-profile.user-profile"
const AFFILIATION = "api::library-affiliation.library-affiliation"

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
  const [profile] = await strapi.documents(PROFILE).findMany({
    filters: { baUserId: { $eq: item.baUserId } },
    fields: [
      "documentId",
      "contributorRole",
      "username",
      "profileVisibility",
      "isVerifiedLibrarian",
    ],
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
  }
  const changed = Object.keys(data).some((k) => profile[k] !== data[k])
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

async function main() {
  const plan = JSON.parse(process.env.ACCESS_SEED_PLAN ?? "[]")
  const instance = createStrapi({ appDir, distDir: path.join(appDir, "dist") })
  assertLocalDatabase(instance)
  const strapi = await instance.load()
  // Stop the cron jobs bootstrap just started: a second instance must not
  // run the app's scheduled tasks alongside `strapi develop`.
  strapi.cron?.destroy?.()
  strapi.log.level = "error"
  const result = []
  try {
    for (const item of plan) {
      const profileChanged = await applyProfile(strapi, item)
      const claim = await applyClaim(strapi, item)
      result.push({ baUserId: item.baUserId, profileChanged, ...claim })
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
