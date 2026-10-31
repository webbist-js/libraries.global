/** Homepage feature rollout. Preview by default; production writes create drafts only. */
import assert from "node:assert/strict"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { isDeepStrictEqual, parseEnv } from "node:util"

import { homepageRefreshContent } from "./homepage-refresh-content.mjs"

const args = new Set(process.argv.slice(2))
const local = args.has("--local")
const publish = args.has("--publish-local")
const stage = args.has("--stage")
const atlasOnly = args.has("--atlas-only")
const contributionOnly = args.has("--contribution-only")
const knowledgeOnly = args.has("--knowledge-only")
const closingOnly = args.has("--closing-only")
assert.ok(
  [atlasOnly, contributionOnly, knowledgeOnly, closingOnly].filter(Boolean)
    .length <= 1,
  "Select only one homepage section"
)
const bandOnly = atlasOnly
  ? "atlasBand"
  : contributionOnly
    ? "communityBand"
    : closingOnly
      ? "finalCta"
      : null
assert.ok(
  !publish || local,
  "Publication is supported only for explicit local feature development"
)
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
const folder = new URL("../../../.scratch/homepage-rebuild/", import.meta.url)
mkdirSync(folder, { recursive: true, mode: 0o700 })
const save = (name, value) =>
  writeFileSync(new URL(name, folder), JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  })
const base = "single-types/api::homepage.homepage"
async function api(locale, { method = "GET", action = "", data, status } = {}) {
  const url = new URL(`/content-manager/${base}${action}`, origin)
  url.searchParams.set("locale", locale)
  if (method === "GET") url.searchParams.set("status", status ?? "draft")
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify({ ...data, locale }) } : {}),
    signal: AbortSignal.timeout(15000),
  })
  assert.ok(
    response.ok,
    `Homepage ${method} ${locale}: HTTP ${response.status}`
  )
  const result = await response.json()

  return result.data ?? result
}
const clean = (value) =>
  Array.isArray(value)
    ? value.map(clean)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key, val]) => key !== "id" && val != null)
            .map(([key, val]) => [key, clean(val)])
        )
      : value
const projection = (doc, keys) =>
  clean(Object.fromEntries(keys.map((key) => [key, clean(doc[key])])))
// Strapi may refresh sibling locales’ timestamps when shared fields are synchronized.
// Compare their editorial content, rather than treating that timestamp as a concurrent edit.
const contentSnapshot = (doc) =>
  clean(
    Object.fromEntries(
      Object.entries(doc).filter(
        ([key]) =>
          ![
            "id",
            "createdAt",
            "updatedAt",
            "publishedAt",
            "status",
            "localizations",
            "createdBy",
            "updatedBy",
          ].includes(key)
      )
    )
  )
const checkpointName = `${local ? "local" : "production"}-checkpoint.json`
const checkpointPath = new URL(checkpointName, folder)
const checkpoint = existsSync(checkpointPath)
  ? JSON.parse(readFileSync(checkpointPath, "utf8"))
  : {}
const entries = []
for (const locale of ["en", "fr", "cs"]) {
  const before = await api(locale)
  const content = homepageRefreshContent(locale)
  const data = bandOnly
    ? {
        [bandOnly]: {
          ...before[bandOnly],
          title: content[bandOnly].title,
          ...(closingOnly ? {} : { text: content[bandOnly].text }),
        },
      }
    : knowledgeOnly
      ? { knowledgeLinks: content.knowledgeLinks }
      : content
  const keys = Object.keys(data)
  const changed = !isDeepStrictEqual(projection(before, keys), clean(data))
  if (changed && before.status !== "published") {
    assert.equal(
      before.updatedAt,
      checkpoint[locale]?.expectedUpdatedAt,
      `Unrelated homepage draft in ${locale}; preserve it for editorial review`
    )
  }
  const stamp = new Date().toISOString().replaceAll(":", "-")
  save(
    `${local ? "local" : "production"}-${locale}-${stamp}-before.json`,
    before
  )
  entries.push({
    locale,
    before,
    original:
      before.status === "published" ? before : checkpoint[locale]?.before,
    data,
    keys,
    changed,
  })
}
save(
  `${local ? "local" : "production"}-preview.json`,
  entries.map(({ locale, data, changed }) => ({ locale, data, changed }))
)
for (const { locale, before, original, data, keys, changed } of entries) {
  if (!stage && !publish) {
    console.log(JSON.stringify({ locale, changed, mode: "preview" }))
    continue
  }
  const latest = await api(locale)
  assert.deepEqual(
    contentSnapshot(latest),
    contentSnapshot(before),
    `Homepage changed during preparation: ${locale}`
  )
  if (changed) {
    await api(locale, { method: "PUT", data })
    const draft = await api(locale)
    checkpoint[locale] = {
      before: original,
      expectedUpdatedAt: draft.updatedAt,
    }
    save(checkpointName, checkpoint)
    assert.deepEqual(
      projection(draft, keys),
      clean(data),
      `Draft read-back mismatch: ${locale}`
    )
    for (const key of [
      "seo",
      "featuredLibraries",
      "featuredServices",
      "atlasImage",
    ])
      assert.deepEqual(
        clean(draft[key]),
        clean(original[key]),
        `Unrelated ${key} changed: ${locale}`
      )
  }
  if (publish && (changed || latest.status !== "published")) {
    await api(locale, { method: "POST", action: "/actions/publish", data: {} })
    const live = await api(locale, { status: "published" })
    assert.deepEqual(
      projection(live, keys),
      clean(data),
      `Published read-back mismatch: ${locale}`
    )
    delete checkpoint[locale]
    save(checkpointName, checkpoint)
  }
  console.log(
    JSON.stringify({
      locale,
      changed,
      verified: true,
      mode: publish ? "local-published" : "staged",
    })
  )
}
