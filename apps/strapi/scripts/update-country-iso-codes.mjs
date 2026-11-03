/**
 * Fills and corrects country ISO 3166-1 codes from the Atlas boundary
 * baseline (Natural Earth, packages/shared-data/atlas/data/geography.json).
 * Preview by default; `--apply` saves and republishes each changed country,
 * then reads the published version back. `--local` targets local Strapi.
 *
 *   node apps/strapi/scripts/update-country-iso-codes.mjs            # production preview
 *   node apps/strapi/scripts/update-country-iso-codes.mjs --apply    # production
 *   node apps/strapi/scripts/update-country-iso-codes.mjs --local --apply
 *
 * The UK's nations keep their ISO 3166-2 codes (GB-ENG with ENG, and so on):
 * they are not ISO 3166-1 countries. A country with unpublished edits is
 * skipped so nobody's draft is published by accident.
 */
import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { parseEnv } from "node:util"

const args = new Set(process.argv.slice(2))
const local = args.has("--local")
const apply = args.has("--apply")
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
  "Select --local explicitly for local Strapi"
)
const token = local
  ? env.STRAPI_MCP_TOKEN
  : process.env.STRAPI_PRODUCTION_MCP_TOKEN || env.STRAPI_PRODUCTION_MCP_TOKEN
assert.ok(token, "The selected CMS editorial credential is unavailable")
const target = local ? "local" : "production"

const folder = new URL("../../../.scratch/country-iso/", import.meta.url)
mkdirSync(folder, { recursive: true, mode: 0o700 })
const save = (name, value) =>
  writeFileSync(new URL(name, folder), JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  })

const base = "/content-manager/collection-types/api::country.country"
async function api(path, { method = "GET", body, locale = "en" } = {}) {
  const url = new URL(`${base}${path}`, origin)
  url.searchParams.set("locale", locale)
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60_000),
  })
  assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`)

  return response.json()
}

// ISO 3166-1 reference: Natural Earth's codes, plus a territory it omits.
const geography = JSON.parse(
  readFileSync(
    new URL(
      "../../../packages/shared-data/atlas/data/geography.json",
      import.meta.url
    ),
    "utf8"
  )
)
const reference = new Map(
  geography.countries
    .filter((c) => /^[A-Z]{2}$/.test(c.iso2 ?? "") && /^[A-Z]{3}$/.test(c.iso3))
    .map((c) => [c.iso2, c.iso3])
)
reference.set("UM", "UMI") // United States Minor Outlying Islands
const byIso3 = new Map([...reference].map(([iso2, iso3]) => [iso3, iso2]))
const UK_NATIONS = new Set(["england", "scotland", "wales", "northern-ireland"])

const countries = []
for (let page = 1; ; page++) {
  const res = await api(`?page=${page}&pageSize=100`)
  countries.push(...res.results)
  if (page >= res.pagination.pageCount) break
}
save(
  `${target}-${new Date().toISOString().replaceAll(":", "-")}-before.json`,
  countries
)

const changes = []
const unresolved = []
for (const country of countries) {
  if (UK_NATIONS.has(country.slug)) continue
  const iso2 = country.iso2?.toUpperCase() || null
  const iso3 = country.iso3?.toUpperCase() || null
  const expected =
    iso2 && reference.has(iso2)
      ? { iso2, iso3: reference.get(iso2) }
      : iso3 && byIso3.has(iso3)
        ? { iso2: byIso3.get(iso3), iso3 }
        : null
  if (!expected) {
    unresolved.push({ name: country.name, slug: country.slug, iso2, iso3 })
    continue
  }
  if (expected.iso2 !== country.iso2 || expected.iso3 !== country.iso3)
    changes.push({
      documentId: country.documentId,
      name: country.name,
      status: country.status,
      from: { iso2: country.iso2 ?? null, iso3: country.iso3 ?? null },
      to: expected,
    })
}
save(`${target}-preview.json`, { changes, unresolved })

if (!apply) {
  console.log(
    JSON.stringify({
      target,
      mode: "preview",
      countries: countries.length,
      changes: changes.length,
      unresolved,
    })
  )
  process.exit(0)
}

const done = []
const skipped = []
for (const change of changes) {
  // Someone's unpublished edits must not go live with ours.
  if (change.status !== "published") {
    skipped.push({ name: change.name, reason: `status ${change.status}` })
    continue
  }
  await api(`/${change.documentId}`, { method: "PUT", body: change.to })
  await api(`/${change.documentId}/actions/publish`, {
    method: "POST",
    body: {},
  })
  const live = await api(`/${change.documentId}?status=published`)
  const row = live.data ?? live
  assert.equal(row.iso2, change.to.iso2, `${change.name}: iso2 read-back`)
  assert.equal(row.iso3, change.to.iso3, `${change.name}: iso3 read-back`)
  done.push(change.name)
}
save(`${target}-applied.json`, { done, skipped, unresolved })
console.log(
  JSON.stringify({
    target,
    mode: "applied",
    updated: done.length,
    skipped,
    unresolved,
    verified: true,
  })
)
