/**
 * LibraryOn v4 → libraries.global ingestion pipeline.
 *
 * Usage:
 *   npx tsx scripts/libraryon-ingest.ts [options]
 *
 * Options:
 *   --dry-run           Map records but do not write to Strapi
 *   --limit=N           Stop after N records
 *   --page=N            Start from page N (default: 1)
 *   --page-size=N       Batch size (default: 25, max 100)
 *   --resume            Skip records that already exist by slug
 *   --country=SLUG      Only ingest libraries from this country slug (e.g. england, scotland, wales)
 *   --log=path          Write JSON log to this path (default: ingest-log.json)
 *
 * Env:
 *   STRAPI_URL          Strapi base URL (default: http://127.0.0.1:1337)
 *   STRAPI_API_TOKEN    Full-access Strapi API token (required)
 *   LIBRARYON_API       LibraryOn base URL (default: https://libraryon.org/cms/api)
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs"

import { mapLibraryOnRecord, type LibraryOnRecord } from "./field-mapper"
import { StrapiClient } from "./strapi-client"

const LIBRARYON_API =
  process.env.LIBRARYON_API ?? "https://libraryon.org/cms/api"

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=")

    return [k, v ?? "true"]
  })
)

const DRY_RUN = args["dry-run"] === "true"
const LIMIT = args.limit ? Number.parseInt(args.limit, 10) : Infinity
const START_PAGE = args.page ? Number.parseInt(args.page, 10) : 1
const PAGE_SIZE = args["page-size"]
  ? Math.min(Number.parseInt(args["page-size"], 10), 100)
  : 25
const RESUME = args.resume === "true"
const COUNTRY_FILTER = args.country?.toLowerCase() ?? null // country slug, e.g. "england"
const LOG_PATH = args.log ?? "ingest-log.json"

// ── Log structure ─────────────────────────────────────────────────────────────

interface LogEntry {
  libraryOnId: number
  libraryOnRef: string
  name: string
  status: "created" | "skipped" | "error" | "dry-run"
  documentId?: string
  error?: string
}

const log: LogEntry[] = existsSync(LOG_PATH)
  ? (JSON.parse(readFileSync(LOG_PATH, "utf8")) as LogEntry[])
  : []

const processedRefs = new Set(
  log
    .filter((e) => e.status === "created" || e.status === "skipped")
    .map((e) => e.libraryOnRef)
)

function saveLog() {
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2))
}

// ── LibraryOn fetcher ─────────────────────────────────────────────────────────

interface LibraryOnPage {
  data: LibraryOnRecord[]
  meta: {
    pagination: {
      page: number
      pageSize: number
      pageCount: number
      total: number
    }
  }
}

async function fetchPage(page: number): Promise<LibraryOnPage> {
  const url = new URL(`${LIBRARYON_API}/libraries`)
  url.searchParams.set("pagination[page]", String(page))
  url.searchParams.set("pagination[pageSize]", String(PAGE_SIZE))
  url.searchParams.set("populate[0]", "location")
  url.searchParams.set("populate[1]", "openingTimes")

  const res = await fetch(url.toString())
  if (!res.ok)
    throw new Error(`LibraryOn API error ${res.status}: ${await res.text()}`)

  return res.json() as Promise<LibraryOnPage>
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

async function run() {
  const strapi = new StrapiClient()

  if (!DRY_RUN) {
    await strapi.preloadRelations()
  }

  // Ensure Europe continent exists — all LibraryOn data is UK/Ireland
  const europeDocId = DRY_RUN
    ? null
    : await strapi.findOrCreateContinent("Europe", "europe", "EU")

  // Fetch first page to get total count
  const firstPage = await fetchPage(START_PAGE)
  const totalPages = firstPage.meta.pagination.pageCount
  const totalRecords = firstPage.meta.pagination.total

  console.log(
    `\nLibraryOn: ${totalRecords} libraries across ${totalPages} pages`
  )
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"} | Resume: ${RESUME} | Limit: ${LIMIT}`
  )
  if (COUNTRY_FILTER) console.log(`Country filter: ${COUNTRY_FILTER}`)
  console.log(`Starting from page ${START_PAGE}\n`)

  let processed = 0
  let created = 0
  let skipped = 0
  let errors = 0

  const pagesToFetch = Math.min(
    totalPages - 1,
    Math.max(0, Math.ceil(LIMIT / PAGE_SIZE) - 1)
  )
  const remainingPages = await Promise.all(
    Array.from({ length: pagesToFetch }, (_, i) =>
      fetchPage(START_PAGE + i + 1)
    )
  )
  const allPages = [firstPage, ...remainingPages]

  for (const page of allPages) {
    for (const record of page.data) {
      if (processed >= LIMIT) break

      const mapped = mapLibraryOnRecord(record)
      const { meta, data } = mapped

      // Country filter (by slug, e.g. "england")
      if (COUNTRY_FILTER && meta.countrySlug !== COUNTRY_FILTER) continue

      // Resume: skip refs already in the log
      if (RESUME && processedRefs.has(meta.libraryOnRef)) {
        skipped++
        continue
      }

      processed++

      if (DRY_RUN) {
        const geoLabel = [meta.countryName, meta.regionName, meta.areaName]
          .filter(Boolean)
          .join(" / ")
        console.log(
          `[DRY] ${data.name} (${meta.libraryOnRef}) → ${data.libraryType}, ${geoLabel}`
        )
        log.push({
          libraryOnId: meta.libraryOnId,
          libraryOnRef: meta.libraryOnRef,
          name: data.name,
          status: "dry-run",
        })
        continue
      }

      // Resolve geography — findOrCreate continent/country/region
      if (meta.countrySlug && meta.countryName && europeDocId) {
        const countryDocId = await strapi.findOrCreateCountry(
          meta.countryName,
          meta.countrySlug,
          europeDocId,
          { regionTypeLabel: "County" }
        )
        data.country = { connect: [{ documentId: countryDocId }] }
        data.continent = { connect: [{ documentId: europeDocId }] }

        if (meta.regionSlug && meta.regionName) {
          const regionDocId = await strapi.findOrCreateRegion(
            meta.regionName,
            meta.regionSlug,
            countryDocId,
            europeDocId,
            { typeLabel: "County" }
          )
          data.region = { connect: [{ documentId: regionDocId }] }

          // Area: borough/district level below region (e.g. Wandsworth within Greater London)
          if (meta.areaSlug && meta.areaName) {
            const areaDocId = await strapi.findOrCreateArea(
              meta.areaName,
              meta.areaSlug,
              regionDocId,
              countryDocId,
              { typeLabel: "Borough" }
            )
            data.area = { connect: [{ documentId: areaDocId }] }
          }
        }
      }

      // Resolve accessibility relations
      if (meta.accessibilityNames.length > 0) {
        const accessDocIds = meta.accessibilityNames
          .map((label) => strapi.lookupAccessibility(label))
          .filter(Boolean) as string[]
        if (accessDocIds.length > 0) {
          data.accessibility = {
            connect: accessDocIds.map((documentId) => ({ documentId })),
          }
        }
      }

      // Dedup by slug (set from LibraryOn ref last segment)
      const existingDocId = meta.librarySlug
        ? await strapi.libraryExistsBySlug(meta.librarySlug)
        : null
      if (existingDocId) {
        console.log(`[SKIP] ${data.name} already exists (${existingDocId})`)
        log.push({
          libraryOnId: meta.libraryOnId,
          libraryOnRef: meta.libraryOnRef,
          name: data.name,
          status: "skipped",
          documentId: existingDocId,
        })
        skipped++
        continue
      }

      try {
        const created_lib = await strapi.createLibrary(data)
        console.log(`[OK]   ${data.name} → ${created_lib.documentId}`)
        log.push({
          libraryOnId: meta.libraryOnId,
          libraryOnRef: meta.libraryOnRef,
          name: data.name,
          status: "created",
          documentId: created_lib.documentId,
        })
        created++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[ERR]  ${data.name}: ${msg}`)
        log.push({
          libraryOnId: meta.libraryOnId,
          libraryOnRef: meta.libraryOnRef,
          name: data.name,
          status: "error",
          error: msg,
        })
        errors++
      }

      if (processed % 25 === 0) {
        saveLog()
        console.log(
          `  Progress: ${processed} processed, ${created} created, ${skipped} skipped, ${errors} errors`
        )
      }

      await sleep(80)
    }

    if (processed >= LIMIT) break
  }

  saveLog()
  console.log(
    `\nDone. ${processed} processed → ${created} created, ${skipped} skipped, ${errors} errors`
  )
  console.log(`Log saved to ${LOG_PATH}`)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

run().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
