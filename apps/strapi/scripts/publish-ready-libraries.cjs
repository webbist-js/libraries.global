/** Publish draft-only libraries with entityRef and their missing places. Dry-run by default. */
const assert = require("node:assert/strict")
const { createHash } = require("node:crypto")
const {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} = require("node:fs")
const { createRequire } = require("node:module")
const path = require("node:path")

const ROOT = path.resolve(__dirname, "..")
const REPORTS = path.resolve(ROOT, "../../.scratch/audit-history")
const PLACES = [
  ["continent", "continents"],
  ["country", "countries"],
  ["region", "regions"],
  ["area", "areas"],
]
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === "object" && !(value instanceof Date))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])])
    )

  return value
}
const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b))
const save = (file, value) =>
  writeFileSync(path.join(REPORTS, file), JSON.stringify(value, null, 2), {
    mode: 0o600,
  })

async function libraryFacts(client, ids) {
  const rows = (
    await client.query(
      `SELECT l.id,l.document_id,l.locale,l.entity_ref,l.name,l.slug,l.created_at,
    coalesce((SELECT jsonb_agg(to_jsonb(c)-'id' ORDER BY j."order",j.id)
      FROM libraries_cmps j JOIN components_library_source_records c ON c.id=j.cmp_id
      WHERE j.entity_id=l.id AND j.field='sourceRecords' AND j.component_type='library.source-record'),'[]'::jsonb) AS sources
    FROM libraries l WHERE l.id=ANY($1::int[]) ORDER BY l.id`,
      [ids]
    )
  ).rows
  const result = new Map(rows.map((row) => [row.id, { ...row, places: {} }]))
  for (const [field, table] of PLACES) {
    const relations = (
      await client.query(
        `SELECT j.library_id,t.document_id,t.slug FROM libraries_${field}_lnk j JOIN ${table} t ON t.id=j.${field}_id WHERE j.library_id=ANY($1::int[])`,
        [ids]
      )
    ).rows
    for (const row of relations)
      result.get(row.library_id).places[field] = {
        documentId: row.document_id,
        slug: row.slug,
      }
  }

  return [...result.values()]
}

async function planPublication(client) {
  const candidates = (
    await client.query(`SELECT d.id FROM libraries d WHERE d.published_at IS NULL AND nullif(trim(d.entity_ref),'') IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM libraries p WHERE p.document_id=d.document_id AND p.locale IS NOT DISTINCT FROM d.locale AND p.published_at IS NOT NULL) ORDER BY d.id`)
  ).rows
  const libraries = await libraryFacts(
    client,
    candidates.map((row) => row.id)
  )
  for (const library of libraries) {
    if (
      !library.places.continent ||
      !library.places.country ||
      !library.places.region
    )
      throw new Error(`Missing path relations on ${library.document_id}`)
    const expected = [
      library.places.continent.slug,
      library.places.country.slug,
      library.places.region.slug,
      ...(library.places.area ? [library.places.area.slug] : []),
      library.slug,
    ].join(":")
    if (library.entity_ref !== expected)
      throw new Error(
        `entityRef does not match the location on ${library.document_id}`
      )
  }
  const places = {}
  for (const [, table] of PLACES) {
    places[table] = (
      await client.query(`SELECT d.document_id,d.locale,d.name,d.slug FROM ${table} d
      WHERE d.published_at IS NULL AND NOT EXISTS(SELECT 1 FROM ${table} p WHERE p.document_id=d.document_id AND p.locale IS NOT DISTINCT FROM d.locale AND p.published_at IS NOT NULL) ORDER BY d.id`)
    ).rows
  }
  // Include unpublished ancestors of the selected areas/regions, without republishing live places.
  for (const [child, parent, field] of [
    ["areas", "regions", "region"],
    ["areas", "countries", "country"],
    ["regions", "countries", "country"],
    ["regions", "continents", "continent"],
    ["countries", "continents", "continent"],
  ]) {
    const exists = (
      await client.query("SELECT to_regclass($1) AS table", [
        `${child}_${field}_lnk`,
      ])
    ).rows[0].table
    if (!exists || !places[child].length) continue
    const parents = (
      await client.query(
        `SELECT DISTINCT t.document_id,t.locale,t.name,t.slug FROM ${child} c JOIN ${child}_${field}_lnk j ON j.${child === "countries" ? "country" : child.slice(0, -1)}_id=c.id JOIN ${parent} t ON t.id=j.${field}_id
      WHERE c.document_id=ANY($1::text[]) AND c.published_at IS NULL AND NOT EXISTS(SELECT 1 FROM ${parent} p WHERE p.document_id=t.document_id AND p.locale IS NOT DISTINCT FROM t.locale AND p.published_at IS NOT NULL)`,
        [places[child].map((p) => p.document_id)]
      )
    ).rows
    for (const row of parents)
      if (
        !places[parent].some(
          (p) => p.document_id === row.document_id && p.locale === row.locale
        )
      )
        places[parent].push(row)
  }
  const liveIds = (
    await client.query(
      "SELECT id FROM libraries WHERE published_at IS NOT NULL ORDER BY id"
    )
  ).rows.map((row) => row.id)
  const liveHash = createHash("sha256")
    .update(JSON.stringify(await libraryFacts(client, liveIds)))
    .digest("hex")

  return {
    createdAt: new Date().toISOString(),
    libraries,
    places,
    liveIds,
    liveHash,
  }
}

function verifyLibrary(expected, actual) {
  assert.ok(actual, `Published library missing: ${expected.document_id}`)
  for (const field of [
    "document_id",
    "locale",
    "entity_ref",
    "name",
    "slug",
    "created_at",
    "sources",
    "places",
  ])
    assert.ok(
      equal(expected[field], actual[field]),
      `${field} changed on ${expected.document_id}`
    )
}
/** Stop dispatch on failure and settle every request before allowing a safe resume. */
async function forEachBounded(rows, concurrency, visit) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4)
    throw new Error("Concurrency must be an integer from 1 to 4")
  let cursor = 0,
    failed = false,
    failure
  const worker = async () => {
    while (!failed) {
      const row = rows[cursor++]
      if (!row) return
      try {
        await visit(row)
      } catch (error) {
        if (!failed) failure = error
        failed = true
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, rows.length) }, () => worker())
  )
  if (failed) throw failure
}
module.exports = {
  planPublication,
  libraryFacts,
  verifyLibrary,
  forEachBounded,
}

async function main() {
  const args = process.argv.slice(2),
    apply = args.includes("--apply")
  const concurrency = args.includes("--concurrency")
    ? Number(args[args.indexOf("--concurrency") + 1])
    : 1
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4)
    throw new Error("--concurrency must be an integer from 1 to 4")
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
      "--apply requires a completed pg_dump custom archive via --backup"
    )
  process.loadEnvFile(path.join(ROOT, ".env"))
  if (
    !["localhost", "127.0.0.1", "0.0.0.0"].includes(process.env.DATABASE_HOST)
  )
    throw new Error("Local database required")
  const base = new URL(process.env.STRAPI_URL || "http://127.0.0.1:1337")
  if (!["localhost", "127.0.0.1"].includes(base.hostname))
    throw new Error("Local Strapi required")
  if (!process.env.STRAPI_API_TOKEN || !process.env.STRAPI_BRIDGE_SECRET)
    throw new Error("API token and bridge secret required")
  const req = createRequire(path.join(ROOT, "package.json"))
  const client = new (req("pg").Client)({
    host: "127.0.0.1",
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  })
  mkdirSync(REPORTS, { recursive: true })
  try {
    await client.connect()
    if (apply) await client.query("SELECT pg_advisory_lock(7420112)")
    let plan
    const manifest = path.join(REPORTS, "publication-manifest.json")
    if (apply && existsSync(manifest))
      plan = JSON.parse(readFileSync(manifest, "utf8"))
    else {
      await client.query(
        "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
      )
      plan = await planPublication(client)
      await client.query("ROLLBACK")
      save(apply ? "publication-manifest.json" : "publication-plan.json", plan)
    }
    const summary = {
      mode: apply ? "apply" : "dry-run",
      concurrency,
      libraries: plan.libraries.length,
      places: Object.fromEntries(
        Object.entries(plan.places).map(([key, rows]) => [key, rows.length])
      ),
    }
    console.log(JSON.stringify(summary))
    if (!apply) return
    const progress = {
      startedAt: new Date().toISOString(),
      places: 0,
      libraries: 0,
      alreadyPublished: 0,
    }
    const published = async (table, row) =>
      (
        await client.query(
          `SELECT id FROM ${table} WHERE document_id=$1 AND locale IS NOT DISTINCT FROM $2 AND published_at IS NOT NULL`,
          [row.document_id, row.locale]
        )
      ).rows
    const publish = async (table, row) => {
      if ((await published(table, row)).length) {
        progress.alreadyPublished++

        return
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        // A retry after a lost response must not publish the same document twice.
        if ((await published(table, row)).length) return
        try {
          const q = new URLSearchParams({
            status: "published",
            locale: row.locale,
          })
          const response = await fetch(
            new URL(
              `/api/${table}/${encodeURIComponent(row.document_id)}?${q}`,
              base
            ),
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
                "Content-Type": "application/json",
                "x-service-secret": process.env.STRAPI_BRIDGE_SECRET,
                "x-library-ingest": "true",
              },
              body: JSON.stringify({ data: {} }),
              signal: AbortSignal.timeout(30000),
            }
          )
          if (!response.ok) {
            const body = await response.json()
            const error = new Error(
              `${table}/${row.document_id}: HTTP ${response.status} ${body.error?.message || "publication failed"}`
            )
            error.retryable = response.status >= 500
            throw error
          }
          if ((await published(table, row)).length !== 1)
            throw new Error(
              `Publication did not produce one live version: ${row.document_id}`
            )

          return
        } catch (error) {
          if (attempt === 2 || error.retryable === false) throw error
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }
    }
    for (const [, table] of PLACES)
      for (const row of plan.places[table]) {
        await publish(table, row)
        progress.places++
        if (progress.places % 25 === 0) console.log(JSON.stringify(progress))
      }
    await forEachBounded(plan.libraries, concurrency, async (row) => {
      await publish("libraries", row)
      const live = await published("libraries", row)
      verifyLibrary(
        row,
        (
          await libraryFacts(
            client,
            live.map((p) => p.id)
          )
        )[0]
      )
      progress.libraries++
      if (progress.libraries % 25 === 0) {
        save("publication-progress.json", progress)
        console.log(JSON.stringify(progress))
      }
    })
    const liveHash = createHash("sha256")
      .update(JSON.stringify(await libraryFacts(client, plan.liveIds)))
      .digest("hex")
    if (liveHash !== plan.liveHash)
      throw new Error("Previously published library facts changed")
    const remaining = (
      await client.query(
        `SELECT count(*)::int n FROM libraries d WHERE d.published_at IS NULL AND nullif(trim(d.entity_ref),'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM libraries p WHERE p.document_id=d.document_id AND p.locale IS NOT DISTINCT FROM d.locale AND p.published_at IS NOT NULL)`
      )
    ).rows[0].n
    if (remaining)
      throw new Error(`${remaining} eligible draft-only libraries remain`)
    const count = (
      await client.query(
        "SELECT count(*)::int n FROM libraries WHERE published_at IS NOT NULL"
      )
    ).rows[0].n
    const result = {
      ...summary,
      ...progress,
      completedAt: new Date().toISOString(),
      publishedLibraries: count,
      remainingEligibleDrafts: remaining,
      verified: [
        "original entityRef and all location links",
        "original name, slug and creation date",
        "all source records, IDs, URLs and retrieval dates",
        "previously published library facts unchanged",
      ],
    }
    save("publication-result.json", result)
    console.log(JSON.stringify(result))
  } finally {
    await client.end()
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
