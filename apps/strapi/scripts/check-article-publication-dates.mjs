/**
 * Read-only preview, before the release, of what its boot backfill changes for
 * published Knowledge and Journal articles: the Publication Date each
 * locale receives and the republish history rows that become edits.
 * Never writes.
 *
 *   node apps/strapi/scripts/check-article-publication-dates.mjs          # production
 *   node apps/strapi/scripts/check-article-publication-dates.mjs --local  # local
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { parseEnv } from "node:util"

const local = process.argv.includes("--local")
const env = parseEnv(
  readFileSync(
    process.env.CMS_ENV_FILE || new URL("../.env", import.meta.url),
    "utf8"
  )
)
const origin = local
  ? "http://127.0.0.1:1337"
  : process.env.STRAPI_PRODUCTION_URL ||
    env.STRAPI_PRODUCTION_URL ||
    "http://127.0.0.1:18013"
assert.ok(
  local || new URL(origin).port !== "1337",
  "Explicit production connection required"
)
const token = local
  ? env.STRAPI_MCP_TOKEN
  : process.env.STRAPI_PRODUCTION_MCP_TOKEN || env.STRAPI_PRODUCTION_MCP_TOKEN
assert.ok(token, "Selected editorial credential required")

async function get(path) {
  const response = await fetch(`${origin}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`GET ${path} → ${response.status}`)

  return response.json()
}

async function published(model) {
  const rows = []
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({
      status: "published",
      locale: "*",
      "fields[0]": "slug",
      "fields[1]": "locale",
      "fields[2]": "publishedAt",
      "pagination[page]": String(page),
      "pagination[pageSize]": "100",
      sort: "id:asc",
    })
    const body = await get(`/${model}?${query}`)
    rows.push(...body.data)
    if (page >= (body.meta?.pagination?.pageCount ?? 1)) return rows
  }
}

async function history(kind, documentId) {
  const rows = []
  for (let page = 1; ; page++) {
    const body = await get(
      `/content-moderation/articles/${kind}/${documentId}/history?page=${page}&pageSize=100`
    )
    rows.push(...body.data)
    if (rows.length >= (body.meta?.total ?? 0) || body.data.length === 0)
      return rows.reverse()
  }
}

for (const [kind, model] of [
  ["blog", "blog-articles"],
  ["wiki", "wiki-articles"],
]) {
  const articles = await published(model)
  const histories = new Map()
  let dated = 0
  let republishes = 0
  console.log(
    `\n${kind === "blog" ? "Journal" : "Knowledge"}: ${articles.length} published versions`
  )
  for (const article of articles) {
    if (!histories.has(article.documentId))
      histories.set(article.documentId, await history(kind, article.documentId))
    const rows = histories
      .get(article.documentId)
      .filter((row) => row.locale === article.locale)
    let live = false
    let repeats = 0
    for (const row of rows) {
      if (row.kind === "published") {
        if (live) repeats++
        live = true
      } else if (row.kind === "unpublished" || row.kind === "deleted")
        live = false
    }
    republishes += repeats
    const first = rows.find((row) => row.kind === "published")?.changedAt
    const date = [first, article.publishedAt].filter(Boolean).sort()[0]
    dated++
    console.log(
      `  ${article.locale}  ${article.slug}  → ${date}${repeats ? `  (${repeats} republish${repeats === 1 ? "" : "es"} become edits)` : ""}`
    )
  }
  console.log(
    `  ${dated} versions get a Publication Date; ${republishes} history rows become edits`
  )
}
