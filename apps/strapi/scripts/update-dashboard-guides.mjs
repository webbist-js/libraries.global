/** Review all Knowledge locales; stage only dashboard corrections. Never publishes. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { isDeepStrictEqual, parseEnv } from "node:util"

import { dashboardGuideBody } from "./dashboard-guide-content.mjs"
import { stripComponentIds } from "./team-pricing-content.mjs"

const args = new Set(process.argv.slice(2))
const stage = args.has("--stage")
const offline = args.has("--offline-preview")
assert.ok(
  !stage || !offline,
  "Offline snapshots are review material, never a write target"
)
const env = parseEnv(
  readFileSync(
    process.env.CMS_ENV_FILE || new URL("../.env", import.meta.url),
    "utf8"
  )
)
const origin =
  process.env.STRAPI_PRODUCTION_URL ||
  env.STRAPI_PRODUCTION_URL ||
  (offline ? "https://cms.invalid" : null)
assert.ok(origin, "An explicit production editorial URL is required")
assert.notEqual(
  new URL(origin).port,
  "1337",
  "This helper targets production; local snapshots are preview-only"
)
const token =
  process.env.STRAPI_PRODUCTION_MCP_TOKEN ||
  env.STRAPI_PRODUCTION_MCP_TOKEN ||
  env.STRAPI_MCP_TOKEN
const folder = new URL(
  "../../../.scratch/dashboard-guide-rollout/",
  import.meta.url
)
mkdirSync(folder, { recursive: true, mode: 0o700 })
const save = (name, value) =>
  writeFileSync(new URL(name, folder), JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  })
const base = "collection-types/api::wiki-article.wiki-article"
async function api(path, locale, method = "GET", data) {
  assert.ok(token, "The production editorial credential is unavailable")
  const url = new URL(`/content-manager/${path}`, origin)
  url.searchParams.set("locale", locale)
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify({ ...data, locale }) } : {}),
    signal: AbortSignal.timeout(15000),
  })
  assert.ok(response.ok, `CMS ${method}: HTTP ${response.status}`)

  return response.json()
}
const document = (response) => response.data ?? response
const get = async (id, locale, status) =>
  document(await api(`${base}/${id}?status=${status}`, locale))
const clean = stripComponentIds
const evidence = (doc) =>
  Object.fromEntries(
    [
      "title",
      "summary",
      "slug",
      "author",
      "featured",
      "priority",
      "articleStatus",
      "body",
      "heroImage",
      "seo",
    ]
      .filter((key) => doc[key] !== undefined)
      .map((key) => [key, clean(doc[key])])
  )
const unchangedMetadata = (doc) => {
  const value = evidence(doc)
  delete value.body

  return value
}
const entries = [],
  audit = []
for (const locale of ["en", "fr", "cs"]) {
  let rows = []
  if (offline)
    rows = JSON.parse(
      readFileSync(
        new URL(
          `../../../.scratch/dashboard-final-pass/local-knowledge-${locale}.json`,
          import.meta.url
        ),
        "utf8"
      )
    ).results
  else
    for (let page = 1; page <= 20; page++) {
      const response = await api(
        `${base}?status=draft&page=${page}&pageSize=100`,
        locale
      )
      rows.push(...response.results)
      if (page >= response.pagination.pageCount) break
      assert.ok(page < 20, "Knowledge catalogue exceeded the review limit")
    }
  for (const row of rows) {
    const draft = offline ? row : await get(row.documentId, locale, "draft")
    const body = dashboardGuideBody(draft, locale)
    const changed = !isDeepStrictEqual(clean(body), clean(draft.body ?? []))
    audit.push({ locale, slug: draft.slug, changed })
    if (!changed) continue
    const published = offline
      ? null
      : await get(row.documentId, locale, "published")
    if (published)
      assert.ok(
        isDeepStrictEqual(evidence(draft), evidence(published)),
        `Unrelated draft exists: ${locale}/${draft.slug}`
      )
    entries.push({
      locale,
      slug: draft.slug,
      documentId: draft.documentId,
      updatedAt: draft.updatedAt,
      before: draft,
      published,
      body,
    })
  }
}
const plan = {
  preparedAt: new Date().toISOString(),
  source: offline ? "local review snapshots" : "production",
  audit,
  entries,
}
save(offline ? "offline-preview.json" : "production-preview.json", plan)
if (stage) {
  // Complete preflight above precedes any write. Preserve the full before-image.
  save(
    `production-before-${createHash("sha256").update(JSON.stringify(plan)).digest("hex").slice(0, 12)}.json`,
    plan
  )
  for (const entry of entries) {
    const current = await get(entry.documentId, entry.locale, "draft")
    assert.equal(
      current.updatedAt,
      entry.updatedAt,
      "Guide changed after preflight"
    )
    await api(`${base}/${entry.documentId}`, entry.locale, "PUT", {
      body: entry.body,
    })
    const checked = await get(entry.documentId, entry.locale, "draft")
    assert.ok(
      isDeepStrictEqual(clean(checked.body), clean(entry.body)),
      "Saved body differs from reviewed copy"
    )
    assert.ok(
      isDeepStrictEqual(
        unchangedMetadata(checked),
        unchangedMetadata(entry.before)
      ),
      "Unrelated editorial metadata changed"
    )
    const live = await get(entry.documentId, entry.locale, "published")
    assert.ok(
      isDeepStrictEqual(evidence(live), evidence(entry.published)),
      "Published content changed during staging"
    )
    entry.stagedAt = checked.updatedAt
    save("production-staged.json", plan)
  }
}
console.log(
  JSON.stringify(
    {
      source: plan.source,
      reviewed: audit.length,
      changed: entries.map(({ locale, slug }) => ({ locale, slug })),
      staged: stage ? entries.length : 0,
      published: 0,
    },
    null,
    2
  )
)
