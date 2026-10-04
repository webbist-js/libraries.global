/**
 * Seed the Meilisearch library, blog-article and wiki-article indexes from
 * the Strapi REST API, building exactly the documents the plugin builds: the
 * settings, the entry query and the transform all come from
 * config/plugins.ts. Use it on a fresh Meilisearch, or after changing an
 * index's shape. (The event index is filled by the plugin's own hooks.)
 *
 * Usage: pnpm --filter @repo/strapi seed:meilisearch
 * Env:   reads apps/strapi/.env for STRAPI_API_TOKEN, MEILISEARCH_HOST and
 *        MEILISEARCH_MASTER_KEY
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import pluginsConfig from "../config/plugins"

type EntriesQuery = {
  fields: string[]
  populate: Record<string, { fields: string[] }>
  locale?: string
}
type Entry = Record<string, unknown>
type IndexConfig = {
  settings: Record<string, unknown>
  entriesQuery: EntriesQuery
  transformEntry: (args: { entry: Entry }) => Entry
}

/** Index → REST collection. */
export const SEEDED = {
  library: "libraries",
  "blog-article": "blog-articles",
  "wiki-article": "wiki-articles",
} as const

// Only the Meilisearch section is read; the rest of the config gets its
// fallbacks.
function configEnv(_key: string, fallback?: unknown) {
  return fallback
}
configEnv.array = (_key: string, fallback: unknown[] = []) => fallback
configEnv.bool = (_key: string, fallback = false) => fallback
configEnv.int = (_key: string, fallback = 0) => fallback
configEnv.json = (_key: string, fallback: unknown = {}) => fallback

/** The plugin's own config for every seeded index. */
export function seededIndexes() {
  const warn = console.warn
  // The upload section warns that S3 isn't configured; it isn't needed here.
  console.warn = () => {}
  let config: { meilisearch: { config: Record<string, IndexConfig> } }
  try {
    config = pluginsConfig({ env: configEnv }) as typeof config
  } finally {
    console.warn = warn
  }

  return Object.entries(SEEDED).map(([name, apiPath]) => ({
    name,
    apiPath,
    ...config.meilisearch.config[name]!,
  }))
}

/**
 * The plugin's document id, so the plugin's own hooks upsert the seeded
 * documents instead of adding duplicates:
 * `[collection]-[documentId]` plus `-[locale]` when the document has one.
 */
export function meilisearchId(collection: string, doc: Entry): string {
  return typeof doc.locale === "string" && doc.locale !== ""
    ? `${collection}-${doc.documentId}-${doc.locale}`
    : `${collection}-${doc.documentId}`
}

/** The REST query for one page of an index's entries, from its `entriesQuery`. */
export function entriesQueryParams(
  entriesQuery: EntriesQuery,
  page: number,
  pageSize = 100
): URLSearchParams {
  const params = new URLSearchParams({
    "pagination[page]": String(page),
    "pagination[pageSize]": String(pageSize),
    status: "published",
  })
  if (entriesQuery.locale) params.set("locale", entriesQuery.locale)
  entriesQuery.fields.forEach((field, i) => params.set(`fields[${i}]`, field))
  for (const [relation, { fields }] of Object.entries(entriesQuery.populate))
    fields.forEach((field, i) =>
      params.set(`populate[${relation}][fields][${i}]`, field)
    )

  return params
}

function readEnvFile(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(path.resolve(__dirname, "..", ".env"), "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => [
        l.slice(0, l.indexOf("=")).trim(),
        l.slice(l.indexOf("=") + 1).trim(),
      ])
  )
}

async function main() {
  const env = readEnvFile()
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

  async function meili<T = Record<string, unknown>>(
    p: string,
    method: string,
    body?: unknown
  ): Promise<T> {
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

    return res.json() as Promise<T>
  }

  async function fetchAll(apiPath: string, entriesQuery: EntriesQuery) {
    const all: Entry[] = []
    let page = 1
    for (;;) {
      const params = entriesQueryParams(entriesQuery, page)
      const res = await fetch(`${STRAPI}/api/${apiPath}?${params}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      })
      if (!res.ok)
        throw new Error(`Strapi ${apiPath} ${res.status}: ${await res.text()}`)
      const json = (await res.json()) as {
        data?: Entry[]
        meta: { pagination: { page: number; pageCount: number } }
      }
      all.push(...(json.data ?? []))
      if (json.meta.pagination.page >= json.meta.pagination.pageCount) break
      page++
    }

    return all
  }

  async function waitForTask(taskUid: number) {
    for (;;) {
      const t = await meili<{ status: string; error?: unknown }>(
        `/tasks/${taskUid}`,
        "GET"
      )
      if (t.status === "succeeded") return
      if (t.status === "failed") throw new Error(JSON.stringify(t.error))
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  // Documents already stored keep every field they were indexed with, so a
  // reseed replaces the index rather than merging into it.
  async function seedIndex(
    indexName: string,
    settings: Record<string, unknown>,
    docs: Entry[]
  ) {
    const cleared = await meili<{ taskUid: number }>(
      `/indexes/${indexName}/documents`,
      "DELETE"
    )
    await waitForTask(cleared.taskUid)
    const set = await meili<{ taskUid: number }>(
      `/indexes/${indexName}/settings`,
      "PATCH",
      settings
    )
    await waitForTask(set.taskUid)
    const task = await meili<{ taskUid: number }>(
      `/indexes/${indexName}/documents?primaryKey=_meilisearch_id`,
      "PUT",
      docs.map((doc) => ({
        ...doc,
        _meilisearch_id: meilisearchId(indexName, doc),
      }))
    )
    await waitForTask(task.taskUid)
    const stats = await meili<{ numberOfDocuments: number }>(
      `/indexes/${indexName}/stats`,
      "GET"
    )
    console.log(`${indexName} index: ${stats.numberOfDocuments} documents ✓`)
  }

  for (const index of seededIndexes()) {
    const entries = await fetchAll(index.apiPath, index.entriesQuery)
    console.log(
      `Fetched ${entries.length} published ${index.apiPath} (all locales)`
    )
    // Every seeded type is localized and every search filters by `locale`,
    // so an entry without one would be indexed but never found.
    const unlocalized = entries.filter((e) => !e.locale).length
    if (unlocalized > 0) {
      throw new Error(
        `${index.apiPath}: ${unlocalized} entries came back without a locale; ` +
          "does the route's populate shape include it?"
      )
    }
    await seedIndex(
      index.name,
      index.settings,
      entries.map((entry) => index.transformEntry({ entry }))
    )
  }
}

if (process.argv[1]?.endsWith("seed-meilisearch.ts"))
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
