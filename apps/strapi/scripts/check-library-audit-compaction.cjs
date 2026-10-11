/** PostgreSQL regression check: all fixture tables are connection-local temp tables. */
const assert = require("node:assert/strict")
const { createRequire } = require("node:module")
const path = require("node:path")

const { compactBaselines } = require("./compact-library-audit-baselines.cjs")

process.loadEnvFile(path.resolve(__dirname, "../.env"))
if (!["localhost", "127.0.0.1", "0.0.0.0"].includes(process.env.DATABASE_HOST))
  throw new Error("Local database required")
const req = createRequire(path.resolve(__dirname, "../package.json"))
const client = new (req("pg").Client)({
  host: "127.0.0.1",
  port: Number(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})
async function main() {
  await client.connect()
  await client.query(`
    CREATE TEMP TABLE libraries(id int,document_id text,locale text,published_at timestamptz);
    CREATE TEMP TABLE libraries_cmps(id int,entity_id int,cmp_id int);
    CREATE TEMP TABLE components_library_source_records(id int,record_id text,url text);
    CREATE TEMP TABLE datasets(id int,attribution text);
    CREATE TEMP TABLE article_changes(id int,kind text);
    CREATE TEMP TABLE library_changes(id int,library_document_id text,content_locale text,version_status text,action text,source text,field text,previous jsonb,next jsonb,submission_document_id text,entity_ref text,actor_kind text,actor_id text,actor_name text,reviewer_id text,changed_at timestamptz);
    INSERT INTO libraries_cmps VALUES(1,1,1);
    INSERT INTO components_library_source_records VALUES(1,'KEEP','https://source.test');
    INSERT INTO datasets VALUES(1,'Keep the attribution');
    INSERT INTO article_changes VALUES(1,'created');
  `)
  const base = {
    content_locale: "en",
    action: "create",
    source: "import",
    field: "*",
    previous: null,
    next: { name: "Original", sourceRecords: [{ recordId: "KEEP" }] },
    submission_document_id: null,
    entity_ref: "europe:country:region:library",
    actor_kind: "system",
    actor_id: "libraries-global-bot",
    actor_name: "Libraries Global bot",
    reviewer_id: null,
    changed_at: "2026-10-01T00:00:00Z",
  }
  const cases = [
    { name: "identical", draft: {}, published: {} },
    {
      name: "different-data",
      draft: {},
      published: { next: { name: "Changed" } },
    },
    { name: "draft-only", draft: {}, published: null },
    {
      name: "contribution",
      draft: { submission_document_id: "contribution" },
      published: { submission_document_id: "contribution" },
    },
    {
      name: "different-date",
      draft: {},
      published: { changed_at: "2026-10-02T00:00:00Z" },
    },
    {
      name: "different-locale",
      draft: {},
      published: { content_locale: "fr" },
    },
    {
      name: "admin",
      draft: { source: "admin" },
      published: { source: "admin" },
    },
    {
      name: "later-update",
      draft: { action: "update" },
      published: { action: "update" },
    },
    { name: "different-actor", draft: {}, published: { actor_id: "other" } },
    {
      name: "previous-values",
      draft: { previous: { name: "Before" } },
      published: { previous: { name: "Before" } },
    },
    { name: "not-live", draft: {}, published: {}, notLive: true },
  ]
  let id = 0
  const retained = []
  for (const fixture of cases) {
    await client.query("INSERT INTO libraries VALUES($1,$2,'en',NULL)", [
      ++id,
      fixture.name,
    ])
    if (fixture.published && !fixture.notLive)
      await client.query("INSERT INTO libraries VALUES($1,$2,'en',now())", [
        ++id,
        fixture.name,
      ])
    for (const [status, overrides] of [
      ["draft", fixture.draft],
      ["published", fixture.published],
    ]) {
      if (!overrides) continue
      const row = {
        ...base,
        ...overrides,
        id: ++id,
        library_document_id: fixture.name,
        version_status: status,
      }
      const keys = Object.keys(row)
      await client.query(
        `INSERT INTO library_changes(${keys.map((k) => `"${k}"`).join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
        Object.values(row)
      )
      if (fixture.name !== "identical" || status !== "draft")
        retained.push(row.id)
    }
  }
  const before = (
    await client.query("SELECT * FROM library_changes ORDER BY id")
  ).rows
  const dry = await compactBaselines(client)
  assert.equal(dry.identicalDraftBaselines, 1)
  assert.deepEqual(
    (await client.query("SELECT * FROM library_changes ORDER BY id")).rows,
    before
  )
  let reads = 0
  const failing = {
    query: async (sql, values) => {
      const result = await client.query(sql, values)
      if (sql.includes("FROM datasets t") && ++reads === 2)
        result.rows[0].hash = "unexpected-content-change"

      return result
    },
  }
  await assert.rejects(
    compactBaselines(failing, { apply: true }),
    /Content or attribution changed/
  )
  assert.deepEqual(
    (await client.query("SELECT * FROM library_changes ORDER BY id")).rows,
    before
  )
  const applied = await compactBaselines(client, { apply: true })
  assert.equal(applied.identicalDraftBaselines, 1)
  assert.deepEqual(
    (await client.query("SELECT id FROM library_changes ORDER BY id")).rows.map(
      (r) => r.id
    ),
    retained.sort((a, b) => a - b)
  )
  assert.equal(
    (await compactBaselines(client, { apply: true })).identicalDraftBaselines,
    0
  )
  console.log(
    JSON.stringify({
      result: "passed",
      cases: cases.map((c) => c.name),
      checks: [
        "dry-run unchanged",
        "rollback on verification failure",
        "preserve sources and article history",
        "exact retained rows",
        "idempotent",
      ],
    })
  )
}
main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => client.end())
