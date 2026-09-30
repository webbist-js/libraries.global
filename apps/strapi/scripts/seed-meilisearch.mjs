// Seed the Meilisearch `library`, `blog-article` and `wiki-article` indexes
// directly from the Strapi REST API — use after standing up a fresh
// Meilisearch instance, before the plugin's own lifecycle hooks take over on
// publish. (The `event` index is filled by the events plugin's hooks.)
//
// This script must build exactly the documents the plugin builds from
// config/plugins.ts: same fetched fields, same allowlisted document keys, same
// settings. A plain `.mjs` can't import that TypeScript config, so the shapes
// are repeated here and `tests/meilisearch-config.test.ts` asserts parity —
// if the two drift, the test fails.
//
// Usage:  node apps/strapi/scripts/seed-meilisearch.mjs
// Env:    reads apps/strapi/.env for STRAPI_API_TOKEN, MEILISEARCH_HOST,
//         MEILISEARCH_MASTER_KEY

import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

// ---------------------------------------------------------------------------
// Index shapes — mirror config/plugins.ts (parity-tested)
// ---------------------------------------------------------------------------

const MEDIA_FIELDS = ["url", "alternativeText", "formats"]

const ARTICLE_FIELDS = [
  "documentId",
  "locale",
  "title",
  "slug",
  "summary",
  "author",
  "publishedAt",
  "updatedAt",
]
const ARTICLE_POPULATE = {
  section: { fields: ["slug", "name"] },
  category: { fields: ["slug", "name"] },
  heroImage: { fields: MEDIA_FIELDS },
}
const ARTICLE_DOC_KEYS = ["id", ...ARTICLE_FIELDS]
const ARTICLE_DISPLAYED = [
  ...ARTICLE_DOC_KEYS,
  "heroImage",
  "section_slug",
  "section_name",
  "category_slug",
  "category_name",
]

const LIBRARY_FIELDS = [
  "documentId",
  "locale",
  "name",
  "slug",
  "entityRef",
  "shortName",
  "summary",
  "libraryType",
  "operatorType",
  "operationalStatus",
  "foundedYear",
  "city",
  "district",
  "featured",
  "timezone",
  "openingTimes",
  "iiifEndpoint",
  "location",
  "publishedAt",
  "updatedAt",
]
// `location` is only fetched to derive `_geo`; it never reaches the index.
const LIBRARY_DOC_KEYS = [
  "id",
  ...LIBRARY_FIELDS.filter((f) => f !== "location"),
]
const LIBRARY_DISPLAYED = [
  ...LIBRARY_DOC_KEYS,
  "heroImage",
  "continent_slug",
  "continent_name",
  "country_slug",
  "country_name",
  "country_code",
  "region_slug",
  "region_name",
  "area_slug",
  "area_name",
  "accessibility_names",
  "service_names",
  "amenity_names",
  "_geo",
]

const asRecord = (value) =>
  value != null && typeof value === "object" && !Array.isArray(value)
    ? value
    : null

/** Copy exactly `keys` from `entry`; absent values become `null`. */
const pick = (entry, keys) =>
  Object.fromEntries(keys.map((key) => [key, entry[key] ?? null]))

const mediaSummary = (value) => {
  const media = asRecord(value)

  return media ? pick(media, MEDIA_FIELDS) : null
}

const optionNames = (value) =>
  Array.isArray(value)
    ? value
        .map((option) => asRecord(option)?.name)
        .filter((name) => typeof name === "string" && name !== "")
    : []

const countryCode = (iso2) =>
  typeof iso2 === "string" && iso2 !== "" ? iso2.toUpperCase() : null

const coordinate = (value) => {
  if (value == null || value === "") return null
  const n = Number(value)

  return Number.isFinite(n) ? n : null
}

export const articleDocument = (entry) => {
  const section = asRecord(entry.section)
  const category = asRecord(entry.category)

  return {
    ...pick(entry, ARTICLE_DOC_KEYS),
    heroImage: mediaSummary(entry.heroImage),
    section_slug: section?.slug ?? null,
    section_name: section?.name ?? null,
    category_slug: category?.slug ?? null,
    category_name: category?.name ?? null,
  }
}

export const libraryDocument = (entry) => {
  const continent = asRecord(entry.continent)
  const country = asRecord(entry.country)
  const region = asRecord(entry.region)
  const area = asRecord(entry.area)
  const location = asRecord(entry.location)
  const lat = coordinate(location?.lat)
  const lng = coordinate(location?.lng)

  return {
    ...pick(entry, LIBRARY_DOC_KEYS),
    heroImage: mediaSummary(entry.heroImage),
    continent_slug: continent?.slug ?? null,
    continent_name: continent?.name ?? null,
    country_slug: country?.slug ?? null,
    country_name: country?.name ?? null,
    country_code: countryCode(country?.iso2),
    region_slug: region?.slug ?? null,
    region_name: region?.name ?? null,
    area_slug: area?.slug ?? null,
    area_name: area?.name ?? null,
    accessibility_names: optionNames(entry.accessibility),
    service_names: optionNames(entry.services),
    amenity_names: optionNames(entry.amenities),
    _geo: lat != null && lng != null ? { lat, lng } : null,
  }
}

/** Per index: REST path, the fetch shape, the settings and the builder. */
export const INDEXES = {
  library: {
    apiPath: "libraries",
    settings: {
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
        "area_slug",
        "featured",
        "accessibility_names",
        "service_names",
        "operatorType",
        "_geo",
      ],
      sortableAttributes: ["name", "featured", "_geo"],
      displayedAttributes: LIBRARY_DISPLAYED,
    },
    entriesQuery: {
      fields: LIBRARY_FIELDS,
      populate: {
        continent: { fields: ["slug", "name"] },
        country: { fields: ["iso2", "slug", "name"] },
        region: { fields: ["slug", "name"] },
        area: { fields: ["slug", "name"] },
        accessibility: { fields: ["name"] },
        services: { fields: ["name"] },
        amenities: { fields: ["name"] },
        heroImage: { fields: MEDIA_FIELDS },
      },
    },
    transformEntry: libraryDocument,
  },
  "blog-article": {
    apiPath: "blog-articles",
    settings: {
      searchableAttributes: ["title", "summary", "author", "section_name"],
      filterableAttributes: ["section_slug"],
      displayedAttributes: ARTICLE_DISPLAYED,
    },
    entriesQuery: { fields: ARTICLE_FIELDS, populate: ARTICLE_POPULATE },
    transformEntry: articleDocument,
  },
  "wiki-article": {
    apiPath: "wiki-articles",
    settings: {
      searchableAttributes: [
        "title",
        "summary",
        "section_name",
        "category_name",
      ],
      filterableAttributes: ["section_slug", "category_slug"],
      displayedAttributes: ARTICLE_DISPLAYED,
    },
    entriesQuery: { fields: ARTICLE_FIELDS, populate: ARTICLE_POPULATE },
    transformEntry: articleDocument,
  },
}

/**
 * The plugin's document id, so the plugin's own hooks upsert the seeded
 * documents instead of adding duplicates:
 * `[collection]-[documentId]` plus `-[locale]` when the document has one.
 */
export function meilisearchId(collection, doc) {
  const locale = typeof doc.locale === "string" && doc.locale !== ""

  return locale
    ? `${collection}-${doc.documentId}-${doc.locale}`
    : `${collection}-${doc.documentId}`
}

/** The REST query for one page of an index's entries, from its `entriesQuery`. */
export function entriesQueryParams(entriesQuery, page, pageSize = 100) {
  const params = new URLSearchParams({
    "pagination[page]": String(page),
    "pagination[pageSize]": String(pageSize),
    status: "published",
  })
  entriesQuery.fields.forEach((field, i) => params.set(`fields[${i}]`, field))
  for (const [relation, { fields }] of Object.entries(entriesQuery.populate)) {
    fields.forEach((field, i) =>
      params.set(`populate[${relation}][fields][${i}]`, field)
    )
  }

  return params
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
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

  async function meili(p, method, body) {
    const res = await fetch(`${MEILI}${p}`, {
      method,
      headers: {
        Authorization: `Bearer ${MKEY}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok)
      throw new Error(`${method} ${p} → ${res.status}: ${await res.text()}`)

    return res.json()
  }

  async function fetchAll(apiPath, entriesQuery) {
    const all = []
    let page = 1
    for (;;) {
      const params = entriesQueryParams(entriesQuery, page)
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

  async function waitForTask(taskUid) {
    for (;;) {
      const t = await meili(`/tasks/${taskUid}`, "GET")
      if (t.status === "succeeded") return
      if (t.status === "failed") throw new Error(JSON.stringify(t.error))
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  // Documents already stored keep every field they were indexed with, so a
  // reseed replaces the index rather than merging into it.
  async function seedIndex(indexName, settings, docs) {
    const cleared = await meili(`/indexes/${indexName}/documents`, "DELETE")
    await waitForTask(cleared.taskUid)
    await meili(`/indexes/${indexName}/settings`, "PATCH", settings)
    const task = await meili(
      `/indexes/${indexName}/documents?primaryKey=_meilisearch_id`,
      "PUT",
      docs.map((doc) => ({
        ...doc,
        _meilisearch_id: meilisearchId(indexName, doc),
      }))
    )
    await waitForTask(task.taskUid)
    const stats = await meili(`/indexes/${indexName}/stats`, "GET")
    console.log(`${indexName} index: ${stats.numberOfDocuments} documents ✓`)
  }

  for (const [indexName, index] of Object.entries(INDEXES)) {
    const entries = await fetchAll(index.apiPath, index.entriesQuery)
    console.log(`Fetched ${entries.length} published ${index.apiPath}`)
    await seedIndex(
      indexName,
      index.settings,
      entries.map(index.transformEntry)
    )
  }
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) await main()
