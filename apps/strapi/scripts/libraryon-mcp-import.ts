/**
 * LibraryOn v4 → libraries.global import, written through Strapi's MCP server.
 *
 * Every write goes through the content-manager MCP tools (create_library,
 * publish_library, ...), so records get admin validation and RBAC.
 *
 * Each library is filed under the Region (and, in England, the Area) its
 * coordinates fall in, looked up through postcodes.io (libraryon-placement.ts).
 * It never creates a Region or Area: a library it can't place is logged as an
 * error and skipped. Run the world place import first.
 *
 * Usage:
 *   tsx scripts/libraryon-mcp-import.ts [options]
 *
 * Options:
 *   --limit=N        Process at most N libraries not already in the log (default 100)
 *   --start-page=N   First libraryOn page to read, 100 per page, sorted by id (default 1)
 *   --dry-run        Map and place, but write nothing
 *   --no-publish     Leave libraries (and new taxonomy) as drafts
 *   --log=path       Import log (default ../../.scratch/libraryon-import/log.json);
 *                    postcodes.io answers are cached beside it in districts.json
 *
 * Env: STRAPI_URL, STRAPI_MCP_TOKEN, LIBRARYON_API
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  ACCESSIBILITY_TAXONOMY,
  AMENITY_TAXONOMY,
  SERVICE_TAXONOMY,
  mapLibraryOnRecord,
  type LibraryOnRecord,
  type MappedLibrary,
  type TaxonomyEntry,
} from "./field-mapper"
import {
  districtsFor,
  placeLibrary,
  regionKey,
  type PlaceIndex,
  type Placement,
} from "./libraryon-placement"
import { StrapiMcpClient } from "./mcp-client"

const LIBRARYON_API =
  process.env.LIBRARYON_API ?? "https://libraryon.org/cms/api"
const PAGE_SIZE = 100

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=")

    return [k, v ?? "true"]
  })
)
const LIMIT = Number.parseInt(args.limit ?? "100", 10)
const START_PAGE = Number.parseInt(args["start-page"] ?? "1", 10)
const DRY_RUN = args["dry-run"] === "true"
const PUBLISH = args["no-publish"] !== "true"
const LOG_PATH = path.resolve(
  args.log ?? `${__dirname}/../../../.scratch/libraryon-import/log.json`
)
const DISTRICTS_PATH = path.join(path.dirname(LOG_PATH), "districts.json")
const MAX_FAILED_IN_A_ROW = 25

// ── Log ───────────────────────────────────────────────────────────────────────

interface LogEntry {
  libraryOnId: number
  ref: string
  name: string
  status: "created" | "updated" | "error" | "dry-run"
  documentId?: string
  slug?: string
  error?: string
  at: string
}

const log: LogEntry[] = existsSync(LOG_PATH)
  ? (JSON.parse(readFileSync(LOG_PATH, "utf8")) as LogEntry[])
  : []
const done = new Set(
  log
    .filter((e) => e.status === "created" || e.status === "updated")
    .map((e) => e.ref)
)

function saveLog() {
  mkdirSync(path.dirname(LOG_PATH), { recursive: true })
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2))
}

// ── libraryOn ─────────────────────────────────────────────────────────────────

async function fetchPage(
  page: number
): Promise<{ data: LibraryOnRecord[]; pageCount: number }> {
  const url = new URL(`${LIBRARYON_API}/libraries`)
  url.searchParams.set("pagination[page]", String(page))
  url.searchParams.set("pagination[pageSize]", String(PAGE_SIZE))
  url.searchParams.set("sort", "id:asc")
  url.searchParams.set("populate[services]", "*")
  url.searchParams.set("populate[social]", "*")

  const res = await fetch(url)
  if (!res.ok) throw new Error(`libraryOn ${res.status}: ${await res.text()}`)
  const body = (await res.json()) as {
    data: LibraryOnRecord[]
    meta: { pagination: { pageCount: number } }
  }

  return { data: body.data, pageCount: body.meta.pagination.pageCount }
}

// ── Reference data (geography + taxonomy) ─────────────────────────────────────

interface Doc {
  documentId: string
  name: string
  slug?: string
  entityRef?: string
  source?: string
  summary?: string | null
  gssCode?: string | null
}

const UK = ["england", "scotland", "wales", "northern-ireland"]

class Refs {
  continentId = ""
  countries = new Map<string, string>() // slug → documentId
  places: PlaceIndex = { areasByGss: new Map(), regionsByName: new Map() }
  slugs = new Map<string, string>() // Region or Area documentId → slug
  libraries = new Map<string, Doc>() // slug → doc
  taxonomy = {
    accessibility: new Map<string, string>(), // lower(name) → documentId
    amenity: new Map<string, string>(),
    service: new Map<string, string>(),
  }

  createdTaxonomy: string[] = []

  constructor(private mcp: StrapiMcpClient) {}

  async load() {
    const [europe] = await this.mcp.listAll<Doc>("continent", {
      filters: { slug: { $eq: "europe" } },
    })
    if (!europe) throw new Error("Europe continent not found")
    this.continentId = europe.documentId

    for (const c of await this.mcp.listAll<Doc>("country", {
      filters: { slug: { $in: UK } },
    }))
      this.countries.set(c.slug!, c.documentId)

    const regions = await this.mcp.listAll<Doc>("region", {
      filters: {
        $or: UK.map((c) => ({ entityRef: { $startsWith: `europe:${c}:` } })),
      },
    })
    const englishRegions = new Map<string, string>() // slug → documentId
    for (const r of regions) {
      const country = r.entityRef?.split(":")[1]
      if (!country) continue
      const key = regionKey(country, r.name)
      this.places.regionsByName.set(key, [
        ...(this.places.regionsByName.get(key) ?? []),
        r.documentId,
      ])
      this.slugs.set(r.documentId, r.slug!)
      if (country === "england") englishRegions.set(r.slug!, r.documentId)
    }

    // Only England's districts: an English library's Area is found by GSS code.
    const areas = await this.mcp.listAll<Doc>("area", {
      filters: { entityRef: { $startsWith: "europe:england:" } },
    })
    for (const a of areas) {
      const regionId = englishRegions.get(a.entityRef!.split(":")[2]!)
      if (!regionId || !a.gssCode) continue
      this.places.areasByGss.set(a.gssCode, {
        regionId,
        areaId: a.documentId,
      })
      this.slugs.set(a.documentId, a.slug!)
    }

    for (const l of await this.mcp.listAll<Doc>("library"))
      this.libraries.set(l.slug!, l)

    for (const kind of ["accessibility", "amenity", "service"] as const)
      for (const t of await this.mcp.listAll<Doc>(kind))
        this.taxonomy[kind].set(t.name.toLowerCase(), t.documentId)
  }

  /** Creates (and publishes) any taxonomy entries the mapper needs. */
  async ensureTaxonomy() {
    const sets: [keyof Refs["taxonomy"], TaxonomyEntry[]][] = [
      ["accessibility", ACCESSIBILITY_TAXONOMY],
      ["amenity", AMENITY_TAXONOMY],
      ["service", SERVICE_TAXONOMY],
    ]
    for (const [kind, entries] of sets) {
      for (const e of entries) {
        const existing = this.taxonomy[kind].get(e.name.toLowerCase())
        if (existing) {
          await this.replacePlaceholder(kind, existing, e)
          continue
        }
        if (DRY_RUN) {
          this.createdTaxonomy.push(`${kind}: ${e.name} (dry-run)`)
          continue
        }
        const created = await this.mcp.call<{ data: Doc }>(`create_${kind}`, {
          data: { name: e.name, category: e.category, summary: e.summary },
        })
        if (PUBLISH)
          await this.mcp.call(`publish_${kind}`, {
            documentId: created.data.documentId,
          })
        this.taxonomy[kind].set(e.name.toLowerCase(), created.data.documentId)
        this.createdTaxonomy.push(`${kind}: ${e.name}`)
      }
    }
  }

  // The seeded "Cafes & restaurant" service still has lorem ipsum copy
  private async replacePlaceholder(
    kind: string,
    documentId: string,
    e: TaxonomyEntry
  ) {
    const doc = await this.mcp.call<{ data: Doc }>(`get_${kind}`, {
      documentId,
    })
    if (!doc.data.summary?.toLowerCase().includes("lorem")) return
    if (DRY_RUN) {
      this.createdTaxonomy.push(`${kind}: ${e.name} placeholder copy (dry-run)`)

      return
    }
    await this.mcp.call(`update_${kind}`, {
      documentId,
      data: {
        name: e.name,
        category: e.category,
        summary: e.summary,
        description: [
          { type: "paragraph", children: [{ type: "text", text: e.summary }] },
        ],
      },
    })
    if (PUBLISH) await this.mcp.call(`publish_${kind}`, { documentId })
    this.createdTaxonomy.push(`${kind}: ${e.name} placeholder copy replaced`)
  }

  taxonomyIds(kind: keyof Refs["taxonomy"], names: string[]): string[] {
    return names.flatMap((n) => this.taxonomy[kind].get(n.toLowerCase()) ?? [])
  }
}

// ── Import one library ────────────────────────────────────────────────────────

async function importLibrary(
  mcp: StrapiMcpClient,
  refs: Refs,
  mapped: MappedLibrary,
  placement: Placement
): Promise<LogEntry> {
  const { data, meta } = mapped
  const base = {
    libraryOnId: meta.libraryOnId,
    ref: meta.libraryOnRef,
    name: data.name,
    at: new Date().toISOString(),
  }

  if ("error" in placement)
    throw new Error(`cannot place ${meta.libraryOnRef}: ${placement.error}`)
  const { countrySlug: country, regionId, areaId } = placement
  if (!refs.countries.has(country))
    throw new Error(`cannot place ${meta.libraryOnRef}: no Country ${country}`)

  // Slug: reuse a previous libraryOn import, otherwise avoid colliding with
  // a library from another source by suffixing the authority.
  let slug = data.slug ?? meta.librarySlug!
  let existing = refs.libraries.get(slug)
  if (existing && existing.source !== "libraryon") {
    slug = `${slug}-${meta.areaSlug ?? meta.regionSlug}`
    existing = refs.libraries.get(slug)
  }

  const geoPath = [
    country,
    refs.slugs.get(regionId),
    areaId ? refs.slugs.get(areaId) : null,
    slug,
  ]
    .filter(Boolean)
    .join(":")
  const accessibility = refs.taxonomyIds(
    "accessibility",
    meta.accessibilityNames
  )
  const amenities = refs.taxonomyIds("amenity", meta.amenityNames)
  const services = refs.taxonomyIds("service", meta.serviceNames)

  const payload: Record<string, unknown> = {
    ...data,
    slug,
    entityRef: `europe:${geoPath}`, // recomputed by the entityRef lifecycle
    continent: refs.continentId,
    country: refs.countries.get(country),
    region: regionId,
    area: areaId,
  }

  if (DRY_RUN) return { ...base, slug, status: "dry-run" }

  let documentId: string
  let status: LogEntry["status"]
  if (existing) {
    const rel = (ids: string[]) => ({ set: ids })
    await mcp.call("update_library", {
      documentId: existing.documentId,
      data: {
        ...payload,
        accessibility: rel(accessibility),
        amenities: rel(amenities),
        services: rel(services),
        socialLinks: data.socialLinks ?? [],
      },
    })
    documentId = existing.documentId
    status = "updated"
  } else {
    const rel = (ids: string[]) => ({ connect: ids })
    const created = await mcp.call<{ data: Doc }>("create_library", {
      data: {
        ...payload,
        accessibility: rel(accessibility),
        amenities: rel(amenities),
        services: rel(services),
      },
    })
    documentId = created.data.documentId
    status = "created"
    refs.libraries.set(slug, {
      documentId,
      name: data.name,
      slug,
      source: "libraryon",
    })
  }

  if (PUBLISH) await mcp.call("publish_library", { documentId })

  return { ...base, slug, documentId, status }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const mcp = new StrapiMcpClient()
  await mcp.initialize()

  const refs = new Refs(mcp)
  await refs.load()
  console.log(
    `Loaded ${refs.places.regionsByName.size} UK region names, ${refs.places.areasByGss.size} English districts, ${refs.libraries.size} libraries`
  )
  await refs.ensureTaxonomy()
  if (refs.createdTaxonomy.length)
    console.log(`Taxonomy:\n  ${refs.createdTaxonomy.join("\n  ")}`)

  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"} | publish: ${PUBLISH} | limit: ${LIMIT} | already done: ${done.size}\n`
  )

  const stats = { created: 0, updated: 0, error: 0, "dry-run": 0 }
  const report = {
    status: {} as Record<string, number>,
    operator: {} as Record<string, number>,
    unmappedServices: {} as Record<string, number>,
    unmappedAccessibility: {} as Record<string, number>,
    noLocation: [] as string[],
    noRef: [] as string[],
    unplaced: {} as Record<string, string[]>,
    noHours: 0,
  }
  const bump = (m: Record<string, number>, k: string) =>
    (m[k] = (m[k] ?? 0) + 1)

  let processed = 0
  // Strapi down or the token revoked: stop rather than fail every record.
  let failedInARow = 0
  let aborted = false
  let page = START_PAGE
  while (processed < LIMIT && !aborted) {
    const { data: pageRecords, pageCount } = await fetchPage(page)
    const records = pageRecords.filter((r) => {
      if (!r.attributes.ref) report.noRef.push(`${r.id} ${r.attributes.name}`)

      return r.attributes.ref && !done.has(r.attributes.ref)
    })
    const mappedPage = records.map(mapLibraryOnRecord)
    const located = mappedPage.filter((m) => m.data.location)
    const districts = await districtsFor(
      located.map((m) => ({
        ...m.data.location!,
        postcode: m.data.postalCode,
      })),
      DISTRICTS_PATH
    )
    const districtOf = new Map(
      located.map((m, i) => [m.meta.libraryOnRef, districts[i] ?? null])
    )

    for (const [i, record] of records.entries()) {
      if (processed >= LIMIT) break
      processed++

      const mapped = mappedPage[i]!
      const placement = placeLibrary(
        districtOf.get(mapped.meta.libraryOnRef) ?? null,
        refs.places
      )
      if ("error" in placement) {
        const reason = mapped.data.location ? placement.error : "no coordinates"
        report.unplaced[reason] = [
          ...(report.unplaced[reason] ?? []),
          mapped.meta.libraryOnRef,
        ]
      }
      bump(report.status, mapped.data.operationalStatus!)
      bump(report.operator, mapped.data.operatorType!)
      for (const s of mapped.meta.unmappedServices)
        bump(report.unmappedServices, s)
      for (const s of mapped.meta.unmappedAccessibility)
        bump(report.unmappedAccessibility, s)
      if (!mapped.data.location)
        report.noLocation.push(mapped.meta.libraryOnRef)
      if (!mapped.data.openingTimes) report.noHours++

      let entry: LogEntry
      try {
        entry = await importLibrary(mcp, refs, mapped, placement)
      } catch (err) {
        entry = {
          libraryOnId: record.id,
          ref: record.attributes.ref,
          name: mapped.data.name,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          at: new Date().toISOString(),
        }
        console.error(`[ERR] ${entry.name}: ${entry.error}`)
      }
      stats[entry.status]++
      failedInARow =
        entry.status === "error" && !("error" in placement)
          ? failedInARow + 1
          : 0
      if (failedInARow >= MAX_FAILED_IN_A_ROW) {
        console.error(`Aborting: ${failedInARow} writes failed in a row`)
        aborted = true
        break
      }
      if (!DRY_RUN) {
        log.push(entry)
        if (entry.status !== "error") done.add(entry.ref)
      }
      if (processed % 25 === 0) {
        if (!DRY_RUN) saveLog()
        console.log(`  ${processed} processed`, JSON.stringify(stats))
      }
    }
    if (page >= pageCount) break
    page++
  }
  if (!DRY_RUN) saveLog()

  console.log(`\nDone: ${processed} processed`, JSON.stringify(stats))
  console.log(JSON.stringify(report, null, 2))
  if (aborted) process.exitCode = 1
}

run().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
