// Seed the Meilisearch `library` index directly from the Strapi REST API.
// Mirrors the transformEntry + settings in config/plugins.ts — use after
// standing up a fresh Meilisearch instance, before the plugin's own
// lifecycle hooks take over on publish.
//
// Usage:  node apps/strapi/scripts/seed-meilisearch.mjs
// Env:    reads apps/strapi/.env for STRAPI_API_TOKEN, MEILISEARCH_HOST,
//         MEILISEARCH_MASTER_KEY

import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(path.join(here, "..", ".env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim(),
    ])
)

const STRAPI = env.STRAPI_URL ?? "http://127.0.0.1:1337"
const TOKEN = env.STRAPI_API_TOKEN
const MEILI = env.MEILISEARCH_HOST ?? "http://localhost:7701"
const MKEY = env.MEILISEARCH_MASTER_KEY

if (!TOKEN || !MKEY) {
  console.error(
    "Missing STRAPI_API_TOKEN or MEILISEARCH_MASTER_KEY in apps/strapi/.env"
  )
  process.exit(1)
}

const SETTINGS = {
  searchableAttributes: [
    "name",
    "shortName",
    "summary",
    "city",
    "district",
    "country_name",
    "region_name",
  ],
  filterableAttributes: [
    "libraryType",
    "operationalStatus",
    "continent_slug",
    "country_slug",
    "region_slug",
    "featured",
    "accessibility_names",
    "service_names",
    "operatorType",
    "_geo",
  ],
  sortableAttributes: ["name", "featured", "_geo"],
}

function transformEntry(entry) {
  const continent = entry.continent ?? null
  const country = entry.country ?? null
  const region = entry.region ?? null
  const location = entry.location ?? null
  const accessibility = entry.accessibility ?? null
  const services = entry.services ?? null
  const lat = location?.lat != null ? Number(location.lat) : null
  const lng = location?.lng != null ? Number(location.lng) : null

  return {
    ...entry,
    continent_slug: continent?.slug ?? null,
    continent_name: continent?.name ?? null,
    country_slug: country?.slug ?? null,
    country_name: country?.name ?? null,
    region_slug: region?.slug ?? null,
    region_name: region?.name ?? null,
    accessibility_names: Array.isArray(accessibility)
      ? accessibility.map((a) => a.name).filter(Boolean)
      : [],
    service_names: Array.isArray(services)
      ? services.map((s) => s.name).filter(Boolean)
      : [],
    _geo: lat != null && lng != null ? { lat, lng } : null,
  }
}

async function meili(path, method, body) {
  const res = await fetch(`${MEILI}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${MKEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok)
    throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`)

  return res.json()
}

async function fetchAllLibraries() {
  const all = []
  let page = 1
  for (;;) {
    const params = new URLSearchParams({
      "pagination[page]": String(page),
      "pagination[pageSize]": "100",
      status: "published",
      "populate[continent][fields][0]": "slug",
      "populate[continent][fields][1]": "name",
      "populate[country][fields][0]": "slug",
      "populate[country][fields][1]": "name",
      "populate[region][fields][0]": "slug",
      "populate[region][fields][1]": "name",
      "populate[accessibility][fields][0]": "name",
      "populate[services][fields][0]": "name",
      "populate[heroImage][fields][0]": "url",
      "populate[heroImage][fields][1]": "formats",
    })
    const res = await fetch(`${STRAPI}/api/libraries?${params}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    if (!res.ok) throw new Error(`Strapi ${res.status}: ${await res.text()}`)
    const json = await res.json()
    all.push(...(json.data ?? []))
    const { page: p, pageCount } = json.meta.pagination
    if (p >= pageCount) break
    page++
  }

  return all
}

async function waitForTask(taskUid) {
  for (;;) {
    const t = await meili(`/tasks/${taskUid}`, "GET")
    if (t.status === "succeeded") return
    if (t.status === "failed") throw new Error(JSON.stringify(t.error))
    await new Promise((r) => setTimeout(r, 500))
  }
}

async function seedIndex(indexName, settings, docs) {
  await meili(`/indexes/${indexName}/settings`, "PATCH", settings)
  const task = await meili(
    `/indexes/${indexName}/documents?primaryKey=id`,
    "PUT",
    docs
  )
  await waitForTask(task.taskUid)
  const stats = await meili(`/indexes/${indexName}/stats`, "GET")
  console.log(`${indexName} index: ${stats.numberOfDocuments} documents ✓`)
}

async function fetchAllArticles(apiPath, populateFields) {
  const all = []
  let page = 1
  for (;;) {
    const params = new URLSearchParams({
      "pagination[page]": String(page),
      "pagination[pageSize]": "100",
      status: "published",
    })
    for (const rel of populateFields) {
      params.set(`populate[${rel}][fields][0]`, "slug")
      params.set(`populate[${rel}][fields][1]`, "name")
    }
    const res = await fetch(`${STRAPI}/api/${apiPath}?${params}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    if (!res.ok)
      throw new Error(`Strapi ${apiPath} ${res.status}: ${await res.text()}`)
    const json = await res.json()
    all.push(...(json.data ?? []))
    const { page: p, pageCount } = json.meta.pagination
    if (p >= pageCount) break
    page++
  }

  return all
}

const libraries = await fetchAllLibraries()
console.log(`Fetched ${libraries.length} published libraries from Strapi`)
await seedIndex("library", SETTINGS, libraries.map(transformEntry))

// blog-article — mirrors config/plugins.ts
const blogArticles = await fetchAllArticles("blog-articles", ["section"])
await seedIndex(
  "blog-article",
  {
    searchableAttributes: ["title", "summary", "author", "section_name"],
    filterableAttributes: ["section_slug"],
  },
  blogArticles.map((entry) => ({
    ...entry,
    section_slug: entry.section?.slug ?? null,
    section_name: entry.section?.name ?? null,
  }))
)

// wiki-article — mirrors config/plugins.ts
const wikiArticles = await fetchAllArticles("wiki-articles", [
  "section",
  "category",
])
await seedIndex(
  "wiki-article",
  {
    searchableAttributes: ["title", "summary", "section_name", "category_name"],
    filterableAttributes: ["section_slug", "category_slug"],
  },
  wikiArticles.map((entry) => ({
    ...entry,
    section_slug: entry.section?.slug ?? null,
    section_name: entry.section?.name ?? null,
    category_slug: entry.category?.slug ?? null,
    category_name: entry.category?.name ?? null,
  }))
)
