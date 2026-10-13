import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"

import { projectAtlasLibrary, type AtlasLibrarySource } from "@repo/shared-data"

import { report } from "./runtime.js"

// Reuse the installed worker runtime. This is a read-only local analysis CLI,
// never the production projection source (which uses the authenticated CMS API).
const require = createRequire(
  new URL("../../../apps/sync-worker/package.json", import.meta.url)
)
const dotenv = require("dotenv") as {
  parse: (value: Buffer) => Record<string, string>
}
const { Client } = require("pg") as {
  Client: new (config: unknown) => {
    connect: () => Promise<void>
    query: (sql: string) => Promise<{ rows: Record<string, any>[] }>
    end: () => Promise<void>
  }
}

const env = dotenv.parse(
  await readFile(new URL("../../../apps/strapi/.env", import.meta.url))
)
const host =
  env.DATABASE_HOST === "0.0.0.0"
    ? "localhost"
    : (env.DATABASE_HOST ?? "localhost")
const searchHost = new URL(env.MEILISEARCH_HOST ?? "http://localhost:7701")
if (
  !["localhost", "127.0.0.1", "::1"].includes(host) ||
  !["localhost", "127.0.0.1", "::1"].includes(searchHost.hostname)
)
  throw new Error("Current-corpus estimates are restricted to local services")
const client = new Client({
  host,
  port: Number(env.DATABASE_PORT ?? 5433),
  database: env.DATABASE_NAME,
  user: env.DATABASE_USERNAME,
  password: env.DATABASE_PASSWORD,
  statement_timeout: 10000,
})
await client.connect()
try {
  await client.query("BEGIN READ ONLY")
  const counts = (
    await client.query(
      "SELECT count(*)::integer rows, count(DISTINCT document_id)::integer physical_documents, count(DISTINCT document_id) FILTER (WHERE locale='en' AND published_at IS NOT NULL)::integer canonical_published, avg(pg_column_size(l))::integer average_stored_row_bytes, pg_total_relation_size('libraries')::bigint table_bytes FROM libraries l"
    )
  ).rows[0]
  const sample = (
    await client.query(
      "SELECT document_id, name, slug, locale, library_type, operational_status, operator_type, city, location, timezone, opening_times, founded_year, opened_year, completeness, has_active_feed, catalogue_url, mobile_timetable FROM libraries WHERE locale='en' AND published_at IS NOT NULL ORDER BY id LIMIT 200"
    )
  ).rows
  const mapped = sample.flatMap((row, n) => {
    const source: AtlasLibrarySource = {
      documentId: row.document_id,
      name: row.name,
      slug: row.slug,
      locale: row.locale,
      published: true,
      libraryType: row.library_type,
      operationalStatus: row.operational_status,
      operatorType: row.operator_type,
      mobileTimetable: row.mobile_timetable,
      city: row.city,
      location: row.location,
      timezone: row.timezone,
      openingTimes: row.opening_times,
      foundedYear: row.founded_year,
      openedYear: row.opened_year,
      completeness: row.completeness,
      hasActiveFeed: row.has_active_feed,
      catalogueUrl: row.catalogue_url,
    }
    const projection = projectAtlasLibrary(source, {
      atlasId: n + 1,
      canonicalLocale: "en",
      now: new Date(),
    })

    return projection ? [projection] : []
  })
  const average = mapped.length
    ? mapped.reduce((sum, p) => sum + Buffer.byteLength(JSON.stringify(p)), 0) /
      mapped.length
    : null
  const response = await fetch(new URL("/stats", searchHost), {
    headers: {
      Authorization: `Bearer ${env.MEILISEARCH_ADMIN_API_KEY ?? env.MEILISEARCH_MASTER_KEY ?? ""}`,
    },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok)
    throw new Error(`Local Meili statistics unavailable (${response.status})`)
  const search = (await response.json()) as {
    databaseSize: number
    usedDatabaseSize?: number
    indexes: Record<
      string,
      {
        numberOfDocuments: number
        avgDocumentSize?: number
        rawDocumentDbSize?: number
      }
    >
  }
  const result = {
    measuredAt: new Date().toISOString(),
    source:
      "read-only existing local corpus; 200-row upper bound; no generated dataset/index/archive",
    canonicalLocale: "en",
    counts,
    sample: {
      rows: sample.length,
      mapped: mapped.length,
      averageProjectionBytesWithoutRelations: average,
      limitation:
        "This bounded sample excludes place/facility relations and Notices; projection bytes are a lower-bound estimate, not an exact production footprint",
    },
    existingSearch: {
      allocatedBytes: search.databaseSize,
      usedBytes: search.usedDatabaseSize,
      indexes: Object.fromEntries(
        Object.entries(search.indexes).map(([id, s]) => [
          id,
          {
            documents: s.numberOfDocuments,
            averageDocumentBytes: s.avgDocumentSize,
            rawDocumentBytes: s.rawDocumentDbSize,
          },
        ])
      ),
    },
    estimates: [100000, 1000000, 3000000].map((records) => ({
      records,
      projectionBytesLowerBound:
        average === null ? null : Math.ceil(average * records),
      validation:
        "estimate; measured production/index/staging/retention overhead must be added as data grows",
    })),
  }
  await report("existing-corpus-estimate", result)
  console.log(JSON.stringify(result, null, 2))
  await client.query("ROLLBACK")
} finally {
  await client.end()
}
