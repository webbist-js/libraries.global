/** One-off compaction of identical import baselines. Dry-run by default. */
const { createHash } = require("node:crypto")
const { existsSync, readFileSync, statSync } = require("node:fs")
const { createRequire } = require("node:module")
const path = require("node:path")

const MATCHING_BASELINES = `
  SELECT d.id FROM library_changes d
  WHERE d.version_status = 'draft' AND d.action = 'create'
    AND d.source = 'import' AND d.field = '*'
    AND d.previous IS NULL AND d.next IS NOT NULL
    AND d.submission_document_id IS NULL
    AND EXISTS (
      SELECT 1 FROM libraries live
      WHERE live.document_id = d.library_document_id
        AND live.locale IS NOT DISTINCT FROM d.content_locale
        AND live.published_at IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM library_changes p
      WHERE p.library_document_id = d.library_document_id
        AND p.content_locale IS NOT DISTINCT FROM d.content_locale
        AND p.version_status = 'published' AND p.action = d.action
        AND p.source = d.source AND p.field = d.field
        AND p.previous IS NULL AND p.next = d.next
        AND p.submission_document_id IS NULL
        AND p.entity_ref IS NOT DISTINCT FROM d.entity_ref
        AND p.actor_kind IS NOT DISTINCT FROM d.actor_kind
        AND p.actor_id IS NOT DISTINCT FROM d.actor_id
        AND p.actor_name IS NOT DISTINCT FROM d.actor_name
        AND p.reviewer_id IS NOT DISTINCT FROM d.reviewer_id
        AND p.changed_at = d.changed_at
    )`

async function fingerprint(client, table, excludedIds = []) {
  const excluded = excludedIds.length ? "WHERE id <> ALL($1::int[])" : ""
  const result = await client.query(
    `SELECT count(*)::int AS count,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY id), '')) AS hash
     FROM ${table} t ${excluded}`,
    excludedIds.length ? [excludedIds] : []
  )

  return result.rows[0]
}

async function protectedContent(client) {
  const result = {}
  for (const table of [
    "libraries",
    "libraries_cmps",
    "components_library_source_records",
    "datasets",
    "article_changes",
  ])
    result[table] = await fingerprint(client, table)

  return result
}

async function compactBaselines(client, { apply = false } = {}) {
  await client.query(apply ? "BEGIN" : "BEGIN TRANSACTION READ ONLY")
  try {
    if (apply) {
      await client.query("SELECT pg_advisory_xact_lock(7420111)")
      await client.query("SET LOCAL lock_timeout = '10s'")
      await client.query(
        "LOCK TABLE library_changes, libraries, libraries_cmps, components_library_source_records, datasets, article_changes IN SHARE ROW EXCLUSIVE MODE"
      )
    }
    const ids = (await client.query(MATCHING_BASELINES)).rows.map(
      (row) => row.id
    )
    const before = await fingerprint(client, "library_changes")
    const preserved = await fingerprint(client, "library_changes", ids)
    const content = await protectedContent(client)
    const report = {
      mode: apply ? "apply" : "dry-run",
      before: before.count,
      identicalDraftBaselines: ids.length,
      after: preserved.count,
      protectedContent: content,
    }
    if (apply && ids.length) {
      const removed = await client.query(
        "DELETE FROM library_changes WHERE id = ANY($1::int[]) RETURNING id",
        [ids]
      )
      if (removed.rowCount !== ids.length)
        throw new Error("Unexpected deletion count")
    }
    if (apply) {
      const after = await fingerprint(client, "library_changes")
      if (JSON.stringify(after) !== JSON.stringify(preserved))
        throw new Error("Retained audit history changed")
      if (
        JSON.stringify(await protectedContent(client)) !==
        JSON.stringify(content)
      )
        throw new Error("Content or attribution changed")
      if ((await client.query(MATCHING_BASELINES)).rows.length)
        throw new Error("Identical baselines remain")
      report.deletedIdsHash = createHash("sha256")
        .update(JSON.stringify(ids.sort((a, b) => a - b)))
        .digest("hex")
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK")

    return report
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }
}

module.exports = { compactBaselines, MATCHING_BASELINES }

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const backup = args.includes("--backup")
    ? args[args.indexOf("--backup") + 1]
    : null
  if (
    apply &&
    (!backup ||
      !existsSync(backup) ||
      statSync(backup).size < 1024 ||
      readFileSync(backup).subarray(0, 5).toString() !== "PGDMP")
  )
    throw new Error(
      "--apply requires --backup pointing to a completed pg_dump custom archive"
    )
  process.loadEnvFile(path.resolve(__dirname, "../.env"))
  if (
    !["localhost", "127.0.0.1", "0.0.0.0"].includes(process.env.DATABASE_HOST)
  )
    throw new Error("This prelaunch script requires the local database")
  const req = createRequire(path.resolve(__dirname, "../package.json"))
  const client = new (req("pg").Client)({
    host: "127.0.0.1",
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  })
  try {
    await client.connect()
    console.log(
      JSON.stringify(await compactBaselines(client, { apply }), null, 2)
    )
  } finally {
    await client.end()
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
