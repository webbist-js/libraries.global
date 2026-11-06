/**
 * Rebuilds recognition counters (`acceptedContributions`,
 * `lastContributionAt`) on user profiles from Rewards point events.
 *
 * Preview by default: reports how many profiles would change and rolls back.
 * Pass `--apply` to write. Profiles are read in bounded keyset pages by id;
 * each page's events are aggregated in one query. Only qualifying, positive
 * events count (`isQualifyingContribution` from @repo/access): streaks,
 * manual adjustments and automatic bonuses never do. Each point event has a
 * unique idempotency key, so one award counts once.
 *
 *   node scripts/recount-recognition.cjs            # preview
 *   node scripts/recount-recognition.cjs --apply    # write
 *
 * Prints counts only: never user ids, tokens or connection details.
 */
const { createRequire } = require("node:module")
const path = require("node:path")

const PAGE_SIZE = 500

async function readProfilePage(client, after, size) {
  return (
    await client.query(
      `SELECT id, ba_user_id, accepted_contributions, last_contribution_at
         FROM user_profiles
        WHERE id > $1 AND ba_user_id IS NOT NULL
        ORDER BY id ASC
        LIMIT $2`,
      [after, size]
    )
  ).rows
}

async function readTotals(client, page, actions) {
  return new Map(
    (
      await client.query(
        `SELECT ba_user_id, count(*)::int AS accepted, max(awarded_at) AS last_at
           FROM rw_point_events
          WHERE ba_user_id = ANY($1::text[])
            AND action = ANY($2::text[])
            AND points > 0
          GROUP BY ba_user_id`,
        [page.map((row) => row.ba_user_id), actions]
      )
    ).rows.map((row) => [row.ba_user_id, row])
  )
}

function isUnchanged(profile, accepted, lastAt) {
  const currentLast = profile.last_contribution_at
    ? new Date(profile.last_contribution_at).getTime()
    : null

  return (
    Number(profile.accepted_contributions ?? 0) === accepted &&
    currentLast === (lastAt ? lastAt.getTime() : null)
  )
}

async function recountPage(client, page, totals, report, apply) {
  for (const profile of page) {
    const total = totals.get(profile.ba_user_id)
    const accepted = total ? Number(total.accepted) : 0
    const lastAt = total?.last_at ? new Date(total.last_at) : null
    if (accepted > 0) report.contributors += 1
    report.acceptedContributions += accepted
    if (isUnchanged(profile, accepted, lastAt)) continue
    report.changed += 1
    if (apply)
      await client.query(
        `UPDATE user_profiles
            SET accepted_contributions = $2, last_contribution_at = $3
          WHERE id = $1`,
        [profile.id, accepted, lastAt]
      )
  }
}

async function recountRecognition(
  client,
  { apply = false, actions, pageSize = PAGE_SIZE } = {}
) {
  if (!Array.isArray(actions) || actions.length === 0)
    throw new Error("Qualifying contribution actions are required")
  const size = Math.max(1, Math.min(Number(pageSize) || PAGE_SIZE, 1000))
  await client.query(apply ? "BEGIN" : "BEGIN TRANSACTION READ ONLY")
  try {
    if (apply) await client.query("SELECT pg_advisory_xact_lock(7420131)")
    const report = {
      mode: apply ? "apply" : "preview",
      profiles: 0,
      changed: 0,
      contributors: 0,
      acceptedContributions: 0,
    }
    let after = 0
    for (;;) {
      const page = await readProfilePage(client, after, size)
      if (page.length === 0) break
      after = page.at(-1).id
      report.profiles += page.length
      const totals = await readTotals(client, page, actions)
      await recountPage(client, page, totals, report, apply)
      if (page.length < size) break
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK")

    return report
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }
}

module.exports = { recountRecognition }

async function main() {
  const apply = process.argv.slice(2).includes("--apply")
  try {
    process.loadEnvFile(path.resolve(__dirname, "../.env"))
  } catch {
    // Environment supplied by the caller.
  }
  const req = createRequire(path.resolve(__dirname, "../package.json"))
  const { CONTRIBUTION_ACTIONS } = req("@repo/access")
  const client = new (req("pg").Client)({
    host: process.env.DATABASE_HOST ?? "127.0.0.1",
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  })
  try {
    await client.connect()
    const result = await recountRecognition(client, {
      apply,
      actions: [...CONTRIBUTION_ACTIONS],
    })
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } finally {
    await client.end()
  }
}
if (require.main === module)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
