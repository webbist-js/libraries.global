type ExistingLibrary = {
  id: number
  documentId: string
  libraryType?: { name: string }
  sourceRecords?: { dataset: string; url?: string; recordId?: string }[]
  accessibility?: { documentId: string }[]
  services?: { documentId: string }[]
  amenities?: { documentId: string }[]
  [key: string]: unknown
}
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { mapLibraryOnRecord, type LibraryOnRecord } from "../../../field-mapper"
import { flag, type IngestArgs } from "../../_shared/cli"
import {
  executeDirectoryIngest,
  type DirectoryLibrary,
} from "../../_shared/directory"
import { JsonSources, sourceJson } from "../../_shared/json-source"
import { slugify } from "../../_shared/text"

const LIBRARIES = "https://libraryon.org/cms/api/libraries"
const BOUNDARIES =
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LAD_MAY_2025_UK_BGC_V2/FeatureServer/0/query?where=1%3D1&outFields=LAD25CD,LAD25NM&outSR=4326&f=geojson&orderByFields=LAD25CD"
type Polygon = number[][][]
type Feature = {
  properties: { LAD25CD: string; LAD25NM: string }
  geometry:
    | { type: "Polygon"; coordinates: Polygon }
    | { type: "MultiPolygon"; coordinates: Polygon[] }
}

export function comparableSourceFact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparableSourceFact)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "id")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, comparableSourceFact(item)])
    )

  return value
}

export async function downloadLibraryOn(
  download = sourceJson
): Promise<LibraryOnRecord[]> {
  const records: LibraryOnRecord[] = [],
    ids = new Set<number>()
  let total: number | undefined
  for (let page = 1; page <= 101; page++) {
    const url = new URL(LIBRARIES)
    url.searchParams.set("pagination[page]", String(page))
    url.searchParams.set("pagination[pageSize]", "100")
    url.searchParams.set("sort[0]", "id:asc")
    url.searchParams.set("populate[0]", "location")
    url.searchParams.set("populate[1]", "openingTimes")
    const result = await download(url.toString())
    const pagination = result.meta?.pagination
    if (
      !Array.isArray(result.data) ||
      !Number.isSafeInteger(pagination?.total) ||
      pagination.total < 1 ||
      pagination.total > 10000 ||
      pagination.page !== page
    )
      throw new Error("Invalid LibraryOn page")
    total ??= pagination.total
    if (total !== pagination.total)
      throw new Error(
        "LibraryOn changed during pagination; refresh the snapshot"
      )
    for (const record of result.data) {
      if (
        !Number.isSafeInteger(record.id) ||
        ids.has(record.id) ||
        !record.attributes
      )
        throw new Error("Invalid or duplicate LibraryOn identity")
      ids.add(record.id)
      records.push(record)
    }
    if (!result.data.length) {
      if (records.length !== total)
        throw new Error("Incomplete LibraryOn snapshot")

      return records
    }
  }
  throw new Error("LibraryOn exceeds the source budget")
}

function inRing(x: number, y: number, ring: number[][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!,
      [xj, yj] = ring[j]!
    if (
      yi! > y !== yj! > y &&
      x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!
    )
      inside = !inside
  }

  return inside
}
const boundaryBounds = new WeakMap<Feature, [number, number, number, number]>()

export function districtAt(
  features: Feature[],
  lat: number,
  lng: number
): Feature | undefined {
  const hits = features.filter((feature) => {
    const polygons =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates
    let bounds = boundaryBounds.get(feature)
    if (!bounds) {
      bounds = [Infinity, Infinity, -Infinity, -Infinity]
      for (const rings of polygons)
        for (const [x, y] of rings[0]!) {
          bounds[0] = Math.min(bounds[0], x!)
          bounds[1] = Math.min(bounds[1], y!)
          bounds[2] = Math.max(bounds[2], x!)
          bounds[3] = Math.max(bounds[3], y!)
        }
      boundaryBounds.set(feature, bounds)
    }
    if (
      lng < bounds[0] ||
      lat < bounds[1] ||
      lng > bounds[2] ||
      lat > bounds[3]
    )
      return false

    return polygons.some(
      (rings) =>
        inRing(lng, lat, rings[0]!) &&
        !rings.slice(1).some((ring) => inRing(lng, lat, ring))
    )
  })
  if (hits.length > 1) throw new Error("Overlapping placement boundaries")

  return hits[0]
}

/** Complete source snapshots, exact current placement, draft-only writes and reviewable refresh proposals. */
export async function runEnglandLibraryOn(args: IngestArgs) {
  const nations: Record<string, { code: string; prefix: string }> = {
    england: { code: "GB-ENG", prefix: "E" },
    wales: { code: "GB-WLS", prefix: "W" },
    scotland: { code: "GB-SCT", prefix: "S" },
    "northern-ireland": { code: "GB-NIR", prefix: "N" },
  }
  const selected =
    Object.entries(nations).find(
      ([slug, value]) => args.country === slug || args.country === value.code
    ) ?? (args.country ? undefined : (["england", nations.england] as const))
  if (!selected) throw new Error("Choose one of the four UK nations")
  const [nationSlug, nation] = selected
  const directory = __dirname
  const sources = new JsonSources(
    args.snapshot ?? path.join(directory, ".cache"),
    { offline: Boolean(args.snapshot), refresh: flag(args, "refresh") }
  )
  const snapshot = await sources.read<LibraryOnRecord[]>(
    "libraries",
    LIBRARIES,
    undefined,
    downloadLibraryOn
  )
  const boundaries = await sources.read<{
    features: Feature[]
    exceededTransferLimit?: boolean
  }>("uk-placement-boundaries", BOUNDARIES)
  const snapshotId = createHash("sha256")
    .update(sources.inputs.map((input) => input.sha256).join(":"))
    .digest("hex")
    .slice(0, 24)
  const immutable = path.join(directory, ".snapshots", snapshotId)
  mkdirSync(immutable, { recursive: true })
  for (const input of sources.inputs) {
    const file = path.join(immutable, path.basename(input.file))
    const bytes = readFileSync(input.file)
    if (createHash("sha256").update(bytes).digest("hex") !== input.sha256)
      throw new Error("Source changed while archiving the import")
    if (!existsSync(file)) writeFileSync(file, bytes, { flag: "wx" })
    else if (
      createHash("sha256").update(readFileSync(file)).digest("hex") !==
      input.sha256
    )
      throw new Error("Archived source hash mismatch")
    input.file = file
  }
  const features = boundaries.data.features
  const gazetteer = JSON.parse(
    readFileSync(
      path.resolve(__dirname, "../../gazetteer/data/england.json"),
      "utf8"
    )
  )
  const districts = new Map<string, { region: string; area: string }>()
  for (const region of gazetteer.regions)
    for (const area of region.areas)
      districts.set(area.gssCode, { region: region.name, area: area.name })
  for (const feature of features ?? []) {
    const code = feature.properties.LAD25CD
    if (/^[WSN]/.test(code))
      districts.set(code, {
        region:
          feature.properties.LAD25NM === "Na h-Eileanan Siar"
            ? "Nah-Eileanan Siar"
            : feature.properties.LAD25NM,
        area: "",
      })
  }
  if (
    !Array.isArray(features) ||
    features.length !== districts.size ||
    boundaries.data.exceededTransferLimit ||
    new Set(features.map((feature) => feature.properties.LAD25CD)).size !==
      districts.size ||
    features.some((feature) => !districts.has(feature.properties.LAD25CD))
  )
    throw new Error(
      "Current placement geography does not reconcile with the UK gazetteer"
    )
  const libraries: DirectoryLibrary[] = [],
    skipped = []
  const sourceFeatures = new Map<
    string,
    { accessibility: string[]; services: string[]; amenities: string[] }
  >()
  for (const record of snapshot.data) {
    if (!record.attributes.name?.trim()) {
      skipped.push({
        recordId: String(record.id),
        name: "",
        reason: "Source name is missing",
      })
      continue
    }
    const mapped = mapLibraryOnRecord({
      ...record,
      attributes: { ...record.attributes, ref: record.attributes.ref ?? "" },
    })
    const base = { recordId: String(record.id), name: mapped.data.name }
    if (mapped.meta.countrySlug && mapped.meta.countrySlug !== nationSlug) {
      skipped.push({ ...base, reason: `Outside the ${nationSlug} profile` })
      continue
    }
    const coordinate = mapped.data.location
    const district =
      coordinate &&
      Number.isFinite(coordinate.lat) &&
      Number.isFinite(coordinate.lng)
        ? districtAt(features, coordinate.lat, coordinate.lng)
        : undefined
    if (!district || !district.properties.LAD25CD.startsWith(nation.prefix)) {
      skipped.push({
        ...base,
        reason:
          "No exact current ONS district at the recorded coordinate; placement requires review",
      })
      continue
    }
    const owner = districts.get(district.properties.LAD25CD)!
    sourceFeatures.set(String(record.id), {
      accessibility: mapped.meta.accessibilityNames,
      services: mapped.meta.serviceNames,
      amenities: mapped.meta.amenityNames,
    })
    // Source IDs make same-named branches and future renames safe. Existing
    // records retain their original slugs through source-record matching.
    libraries.push({
      recordId: String(record.id),
      countryCode: nation.code,
      regionName: owner.region,
      areaName: owner.area || undefined,
      data: {
        ...mapped.data,
        timezone: "Europe/London",
        slug: `${slugify(mapped.data.name).slice(0, 180)}-libraryon-${record.id}`,
      },
      warnings: [
        ...mapped.meta.unmappedServices.map(
          (value) => `Unmapped service: ${value}`
        ),
        ...mapped.meta.unmappedAccessibility.map(
          (value) => `Unmapped accessibility: ${value}`
        ),
      ],
    })
  }
  const details: Record<string, unknown> = {
    snapshotDirectory: immutable,
    sourceVintage: snapshot.retrievedAt,
    placementBoundaryVersion: "ONS-LAD-May-2025-BGC-v2",
    analyticalBoundaryVersion: "ONS-LAD-2023 (2024 population controls)",
    refreshPolicy:
      "Existing records are preserved. Source changes are proposals; absent source IDs are reported, never automatically closed or deleted.",
  }
  const existingMatches = new Map<string, string>()
  const legacyMatches: { recordId: string; documentId: string; url: string }[] =
    []
  if (flag(args, "apply") || flag(args, "check-cms")) {
    const { StrapiClient } = await import("../../../strapi-client")
    const client = new StrapiClient()
    for (const [field, endpoint] of [
      ["accessibility", "accessibility-features"],
      ["services", "services"],
      ["amenities", "amenities"],
    ] as const) {
      const taxonomy = await client.findAll(endpoint, { fields: ["name"] })
      for (const row of libraries) {
        const names = sourceFeatures.get(row.recordId)![field]
        const ids: string[] = []
        for (const name of names) {
          const matches = taxonomy.filter(
            (entry) => String(entry.name).toLowerCase() === name.toLowerCase()
          )
          if (matches.length === 1) ids.push(matches[0]!.documentId)
          else row.warnings.push(`Unresolved ${field}: ${name}`)
        }
        if (ids.length)
          row.data[field] = {
            connect: ids.map((documentId) => ({ documentId })),
          }
      }
    }
    const existing = await client.findAll<ExistingLibrary>("libraries", {
      filters: { sourceRecords: { dataset: { $eq: "libraryon" } } },
      status: "draft",
      fields: [
        "name",
        "location",
        "libraryType",
        "operationalStatus",
        "streetAddress",
        "postalCode",
        "phone",
        "email",
        "website",
        "operatorType",
        "timezone",
        "openingTimes",
        "city",
        "openedYear",
        "closedYear",
        "catalogueUrl",
        "membershipUrl",
        "virtualTourUrl",
        "virtualTourEmbed",
        "socialLinks",
        "contentUpdatedAt",
      ],
      populate: [
        "sourceRecords",
        "accessibility",
        "services",
        "amenities",
        "socialLinks",
      ],
    })
    const bySource = new Map<string, ExistingLibrary>()
    const byUrl = new Map<string, ExistingLibrary>()
    for (const library of existing)
      for (const source of library.sourceRecords ?? [])
        if (source.dataset === "libraryon") {
          if (source.url && source.url !== "https://libraryon.org") {
            if (
              byUrl.has(source.url) &&
              byUrl.get(source.url).documentId !== library.documentId
            )
              throw new Error("Ambiguous legacy LibraryOn URL")
            byUrl.set(source.url, library)
          }
          if (!source.recordId) continue
          if (
            bySource.has(source.recordId) &&
            bySource.get(source.recordId).documentId !== library.documentId
          )
            throw new Error("Duplicate LibraryOn ownership")
          bySource.set(source.recordId, library)
        }
    for (const row of libraries) {
      const matched =
        bySource.get(row.recordId) ?? byUrl.get(row.data.sourceUrl)
      if (!matched) continue
      existingMatches.set(row.recordId, matched.documentId)
      if (!bySource.has(row.recordId))
        legacyMatches.push({
          recordId: row.recordId,
          documentId: matched.documentId,
          url: row.data.sourceUrl!,
        })
      bySource.set(row.recordId, matched)
    }
    details.legacyIdentityMatches = legacyMatches.length
    details.proposedUpdates = libraries.flatMap((row) => {
      const current = bySource.get(row.recordId)
      if (!current) return []
      const facts: Record<string, unknown> = {
        ...current,
        libraryType: current.libraryType?.name ?? current.libraryType,
      }
      for (const field of ["accessibility", "services", "amenities"])
        facts[field] = (
          current[field as "accessibility" | "services" | "amenities"] ?? []
        )
          .map((item) => item.documentId)
          .sort()
      const proposed = { ...row.data }
      for (const field of ["accessibility", "services", "amenities"]) {
        if (row.data[field])
          proposed[field] = row.data[field].connect
            .map((item) => item.documentId)
            .sort()
      }
      const changes = Object.fromEntries(
        [
          "name",
          "location",
          "libraryType",
          "operationalStatus",
          "streetAddress",
          "postalCode",
          "phone",
          "email",
          "website",
          "operatorType",
          "timezone",
          "openingTimes",
          "city",
          "openedYear",
          "closedYear",
          "catalogueUrl",
          "membershipUrl",
          "virtualTourUrl",
          "virtualTourEmbed",
          "socialLinks",
          "contentUpdatedAt",
          "accessibility",
          "services",
          "amenities",
        ]
          .filter(
            (field) =>
              row.data[field] !== undefined &&
              JSON.stringify(comparableSourceFact(facts[field])) !==
                JSON.stringify(comparableSourceFact(proposed[field]))
          )
          .map((field) => [
            field,
            { current: facts[field], proposed: row.data[field] },
          ])
      )

      return Object.keys(changes).length
        ? [{ recordId: row.recordId, documentId: current.documentId, changes }]
        : []
    })
    const sourceIds = new Set(snapshot.data.map((row) => String(row.id)))
    details.absentSourceRecords = [...bySource]
      .filter(([id]) => !sourceIds.has(id))
      .map(([recordId, library]) => ({
        recordId,
        documentId: library.documentId,
      }))
  }
  const report = await executeDirectoryIngest({
    args,
    directory,
    dataset: "libraryon",
    inputs: sources.inputs,
    retrievedAt: snapshot.retrievedAt,
    sourceCount: snapshot.data.length,
    libraries,
    skipped,
    details,
    existingMatches,
  })
  if (flag(args, "apply") && legacyMatches.length) {
    const { ingestDatabase } = await import("../../_shared/population")
    const database = ingestDatabase()
    try {
      await database.transaction(async (trx) => {
        for (const match of legacyMatches) {
          const components = await trx("components_library_source_records as c")
            .join("libraries_cmps as j", "j.cmp_id", "c.id")
            .join("libraries as l", "l.id", "j.entity_id")
            .where({
              "l.document_id": match.documentId,
              "j.field": "sourceRecords",
              "j.component_type": "library.source-record",
              "c.dataset": "libraryon",
              "c.url": match.url,
            })
            .whereNull("c.record_id")
            .select("c.id")
          await trx("components_library_source_records")
            .whereIn(
              "id",
              components.map((row: { id: number }) => row.id)
            )
            .whereNull("record_id")
            .update({
              record_id: match.recordId,
              retrieved_at: snapshot.retrievedAt.slice(0, 10),
            })
        }
      })
    } finally {
      await database.destroy()
    }
  }
  mkdirSync(path.join(directory, ".runs"), { recursive: true })
  writeFileSync(
    path.join(directory, ".runs/latest.json"),
    JSON.stringify(report, null, 2)
  )

  return report
}
