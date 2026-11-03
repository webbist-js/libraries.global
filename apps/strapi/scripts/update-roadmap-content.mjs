/**
 * Community Roadmap content. Preview by default; `--stage` saves a draft
 * (production never publishes from here); `--local --publish-local`
 * publishes a local fixture with illustrative dataset imports.
 *
 *   node apps/strapi/scripts/update-roadmap-content.mjs                  # production preview
 *   node apps/strapi/scripts/update-roadmap-content.mjs --stage          # production draft
 *   node apps/strapi/scripts/update-roadmap-content.mjs --local --publish-local
 */
import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { isDeepStrictEqual, parseEnv } from "node:util"

import { roadmapContent } from "./roadmap-content.mjs"

const args = new Set(process.argv.slice(2))
const local = args.has("--local")
const publish = args.has("--publish-local")
const stage = args.has("--stage") || publish
assert.ok(!publish || local, "Publication is only for local development")
const env = parseEnv(
  readFileSync(
    process.env.CMS_ENV_FILE || new URL("../.env", import.meta.url),
    "utf8"
  )
)
const origin = local
  ? "http://127.0.0.1:1337"
  : process.env.STRAPI_PRODUCTION_URL || env.STRAPI_PRODUCTION_URL
assert.ok(origin, "An explicit CMS connection is required")
assert.ok(
  local || new URL(origin).port !== "1337",
  "Select --local explicitly for feature development"
)
const token = local
  ? env.STRAPI_MCP_TOKEN
  : process.env.STRAPI_PRODUCTION_MCP_TOKEN || env.STRAPI_PRODUCTION_MCP_TOKEN
assert.ok(token, "The selected CMS editorial credential is unavailable")

const folder = new URL("../../../.scratch/roadmap-content/", import.meta.url)
mkdirSync(folder, { recursive: true, mode: 0o700 })
const save = (name, value) =>
  writeFileSync(new URL(name, folder), JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  })
const target = local ? "local" : "production"
const locale = "en"
const base = "/content-manager/single-types/api::roadmap.roadmap"

async function api({ method = "GET", action = "", data, status } = {}) {
  const url = new URL(`${base}${action}`, origin)
  url.searchParams.set("locale", locale)
  if (method === "GET") url.searchParams.set("status", status ?? "draft")
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify({ ...data, locale }) } : {}),
    signal: AbortSignal.timeout(15_000),
  })
  if (method === "GET" && response.status === 404) return null
  assert.ok(response.ok, `Roadmap ${method}${action}: HTTP ${response.status}`)
  const body = await response.json()

  return body.data ?? body
}

const strip = (value) =>
  Array.isArray(value)
    ? value.map(strip)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(
              ([key, v]) => key !== "id" && key !== "__component" && v != null
            )
            .map(([key, v]) => [key, strip(v)])
        )
      : value
const content = roadmapContent({ fixtures: local })
const editorial = (doc) =>
  doc
    ? strip(Object.fromEntries(Object.keys(content).map((k) => [k, doc[k]])))
    : null

const before = await api()
const changed = !isDeepStrictEqual(editorial(before), strip(content))
const stamp = new Date().toISOString().replaceAll(":", "-")
save(`${target}-${stamp}-before.json`, before)
save(`${target}-preview.json`, { changed, content })
// An existing draft that differs from the live roadmap is someone's work.
if (stage && before && before.status === "modified")
  assert.fail(
    "The roadmap has unpublished edits; review them in the admin first"
  )

if (!stage) {
  console.log(JSON.stringify({ target, changed, mode: "preview" }))
} else {
  if (changed) {
    await api({ method: "PUT", data: content })
    const draft = await api()
    assert.deepEqual(
      editorial(draft),
      strip(content),
      "Draft read-back mismatch"
    )
  }
  if (publish) {
    await api({ method: "POST", action: "/actions/publish", data: {} })
    const live = await api({ status: "published" })
    assert.deepEqual(
      editorial(live),
      strip(content),
      "Published read-back mismatch"
    )
  }
  console.log(
    JSON.stringify({
      target,
      changed,
      mode: publish ? "local-published" : "staged",
      verified: true,
    })
  )
}
