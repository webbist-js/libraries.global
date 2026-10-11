/**
 * Bounded compatibility audit and reversible JSON-only upgrade.
 * node scripts/opening-schedule-upgrade.cjs report /absolute/path/backup.jsonl
 * node scripts/opening-schedule-upgrade.cjs apply /absolute/path/backup.jsonl
 * node scripts/opening-schedule-upgrade.cjs rollback /absolute/path/backup.jsonl
 * Report is read-only. Apply/rollback never publish, alter source evidence or touch unrelated fields.
 * Reindex the changed library projections after applying or rolling back.
 */
const { createReadStream, createWriteStream } = require("node:fs")
const { once } = require("node:events")
const { createInterface } = require("node:readline")
const path = require("node:path")
const { Client } = require("pg")
const {
  normalizeOpeningSchedule,
  validateOpeningSchedule,
} = require("@repo/shared-data")

process.loadEnvFile(path.resolve(__dirname, "../.env"))
const [mode = "report", backup] = process.argv.slice(2)
if (
  !["report", "apply", "rollback"].includes(mode) ||
  !backup ||
  !path.isAbsolute(backup)
) {
  throw new Error(
    "Use report, apply or rollback with an absolute backup JSONL path"
  )
}
const connection = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT),
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
    }
const client = new Client(connection)
async function run() {
  await client.connect()
  const result = {
    inspected: 0,
    compatible: 0,
    invalid: 0,
    changed: 0,
    conflicts: 0,
  }
  if (mode === "report") {
    const stream = createWriteStream(backup, { flags: "wx", mode: 0o600 })
    await once(stream, "open")
    await client.query("BEGIN READ ONLY")
    let after = 0
    while (true) {
      const { rows } = await client.query(
        "SELECT id, document_id, locale, published_at, opening_times FROM libraries WHERE id > $1 AND opening_times IS NOT NULL ORDER BY id LIMIT 500",
        [after]
      )
      for (const row of rows) {
        const errors = validateOpeningSchedule(row.opening_times)
        const next = errors.length
          ? null
          : normalizeOpeningSchedule(row.opening_times)
        result.inspected++
        result[errors.length ? "invalid" : "compatible"]++
        if (!stream.write(JSON.stringify({ ...row, errors, next }) + "\n"))
          await once(stream, "drain")
      }
      if (rows.length < 500) break
      after = rows.at(-1).id
    }
    await client.query("ROLLBACK")
    stream.end()
    await once(stream, "finish")
  } else {
    const input = createInterface({
      input: createReadStream(backup),
      crlfDelay: Infinity,
    })
    for await (const line of input) {
      if (!line.trim()) continue
      const row = JSON.parse(line)
      result.inspected++
      if (!row.next || row.errors?.length) {
        result.invalid++
        continue
      }
      const before = mode === "apply" ? row.opening_times : row.next
      const after = mode === "apply" ? row.next : row.opening_times
      const updated = await client.query(
        "UPDATE libraries SET opening_times = $1::jsonb WHERE id = $2 AND document_id = $3 AND locale = $4 AND opening_times = $5::jsonb AND published_at IS NOT DISTINCT FROM $6::timestamptz RETURNING document_id",
        [
          JSON.stringify(after),
          row.id,
          row.document_id,
          row.locale,
          JSON.stringify(before),
          row.published_at,
        ]
      )
      if (updated.rowCount) result.changed++
      else result.conflicts++
    }
  }
  console.log(JSON.stringify({ mode, backup, ...result }))
}
run()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => client.end())
