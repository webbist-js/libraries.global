/**
 * Strapi-side half of seed-access-fixtures.ts. Local only.
 *
 * Strapi REST cannot make these writes, by design: user-profile exposes only
 * find/findOne, and library-affiliation has no routes at all (P-A hardening).
 * So this boots a headless Strapi instance (load() without listen(), cron
 * stays off) against the local database and writes through the Document
 * Service, the same way the moderation service does on claim approval.
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
  }
  // Mirror a real claim approval (grantVerifiedLibrarian) for the librarian.
  if (item.claimLibrary) data.isVerifiedLibrarian = true
  const changed = Object.keys(data).some((k) => profile[k] !== data[k])
  if (changed)
    await strapi
      .documents(PROFILE)
      .update({ documentId: profile.documentId, data })

  return changed
}

async function applyClaim(strapi, item) {
  if (!item.claimLibrary) return false
  const existing = await strapi.documents(AFFILIATION).findMany({
    filters: { baUserId: { $eq: item.baUserId } },
    limit: 1,
  })
  if (existing[0]) return false
  await strapi.documents(AFFILIATION).create({
    data: {
      baUserId: item.baUserId,
      // Schema enum is email_domain | vouching | contact_us; a moderated
      // (manually reviewed) claim is contact_us, the schema default.
      verificationMethod: "contact_us",
      library: { connect: [{ documentId: item.claimLibrary }] },
    },
  })

  return true
}

async function main() {
  const plan = JSON.parse(process.env.ACCESS_SEED_PLAN ?? "[]")
  const strapi = await createStrapi({
    appDir,
    distDir: path.join(appDir, "dist"),
  }).load()
  strapi.log.level = "error"
  const result = []
  try {
    for (const item of plan) {
      const profileChanged = await applyProfile(strapi, item)
      const claimCreated = await applyClaim(strapi, item)
      result.push({ baUserId: item.baUserId, profileChanged, claimCreated })
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
