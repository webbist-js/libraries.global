import path from "node:path"
import { gunzipSync } from "node:zlib"

import { mapGermanLibrary, type GermanLibrary } from "./map"
import { flag, type IngestArgs } from "../../_shared/cli"
import { executeDirectoryIngest } from "../../_shared/directory"
import { JsonSources } from "../../_shared/json-source"

const DUMP_URL = "https://data.dnb.de/opendata/bib_lds.jsonld.gz"

/** Extract a single string value from a JSONLD predicate array. */
function jsonLdString(
  obj: Record<string, unknown>,
  uri: string
): string | undefined {
  return (obj[uri] as { "@value"?: string }[] | undefined)?.[0]?.["@value"]
}

/** Extract a URL from a JSONLD predicate array. */
function jsonLdUrl(
  obj: Record<string, unknown>,
  uri: string
): string | undefined {
  return (obj[uri] as { "@id"?: string }[] | undefined)?.[0]?.["@id"]
}

/**
 * Parse JSONLD to extract ISIL records.
 * The dump is a nested array of RDF triples in JSONLD compact format.
 */
function parseIsil(
  data: Record<string, unknown> | Record<string, unknown>[]
): Record<string, Partial<GermanLibrary>> {
  const records: Record<string, Partial<GermanLibrary>> = {}

  // Flatten nested arrays recursively
  const flatten = (arr: unknown[]): unknown[] => {
    return arr.flatMap((item) => (Array.isArray(item) ? flatten(item) : item))
  }

  const items = Array.isArray(data) ? flatten(data) : [data]

  for (const item of items) {
    if (typeof item !== "object" || item === null) continue
    const obj = item as Record<string, unknown>
    if (!obj["@id"]) continue

    // Extract ISIL from record URI: https://ld.zdb-services.de/.../organisations/DE-xxx
    const idStr = String(obj["@id"])
    const match = idStr.match(/organisations\/([A-Z]{2}-\d+)/)
    if (!match) continue
    const isil = match[1]

    if (!records[isil]) {
      records[isil] = { isil }
    }
    const rec = records[isil]

    if (!rec.name)
      rec.name = jsonLdString(obj, "http://xmlns.com/foaf/0.1/name")
    if (!rec.shortName)
      rec.shortName = jsonLdString(obj, "http://dbpedia.org/property/shortName")
    if (!rec.phone)
      rec.phone = jsonLdString(obj, "http://www.w3.org/2006/vcard/ns#tel")

    if (!rec.website)
      rec.website = jsonLdUrl(obj, "http://xmlns.com/foaf/0.1/homepage")
    if (!rec.catalogueUrl)
      rec.catalogueUrl = jsonLdUrl(
        obj,
        "http://iflastandards.info/ns/isbd/terms/relation#opac"
      )

    // Address fields (simple extraction from flat structure)
    if (!rec.city)
      rec.city = jsonLdString(obj, "http://www.w3.org/2006/vcard/ns#locality")
    if (!rec.postalCode)
      rec.postalCode = jsonLdString(
        obj,
        "http://www.w3.org/2006/vcard/ns#postal-code"
      )
    if (!rec.streetAddress)
      rec.streetAddress = jsonLdString(
        obj,
        "http://www.w3.org/2006/vcard/ns#street-address"
      )

    // Coordinates (from flattened geo URIs)
    if (!rec.latitude) {
      const lat = jsonLdString(obj, "http://www.opengis.net/ont/geosparql#lat")
      if (lat) rec.latitude = Number.parseFloat(lat)
    }
    if (!rec.longitude) {
      const lon = jsonLdString(obj, "http://www.opengis.net/ont/geosparql#long")
      if (lon) rec.longitude = Number.parseFloat(lon)
    }
  }

  return records
}

export async function runGermany(args: IngestArgs) {
  const sources = new JsonSources(
    args.snapshot ?? path.join(__dirname, ".cache"),
    { offline: Boolean(args.snapshot), refresh: flag(args, "refresh") }
  )

  const snapshot = await sources.read<Record<string, unknown>>(
    "libraries",
    DUMP_URL,
    { bytes: true, checksum: true, "record-count": "20000..26000" },
    async () => {
      const response = await fetch(DUMP_URL, {
        signal: AbortSignal.timeout(60000),
      })
      if (!response.ok) {
        throw new Error(`German ISIL dump HTTP ${response.status}`)
      }
      const raw = Buffer.from(await response.arrayBuffer())
      // May be pre-decompressed by fetch; check gzip magic bytes
      const data =
        raw[0] === 0x1f && raw[1] === 0x8b
          ? gunzipSync(raw).toString("utf8")
          : raw.toString("utf8")

      return JSON.parse(data)
    }
  )

  const rawRecords = parseIsil(snapshot.data)
  const records = Object.values(rawRecords) as GermanLibrary[]

  // Report coverage (ISIL dump has ~34K records, but many share ISILs - departments/branches)
  console.log(`Found ${records.length} unique ISIL organizations`)
  if (records.length < 1000) {
    throw new Error(`German ISIL coverage ${records.length} is too low`)
  }

  // Check for duplicate ISILs
  const isils = records.map((r) => r.isil).filter(Boolean)
  if (new Set(isils).size !== isils.length) {
    throw new Error("Duplicate ISIL identifiers found")
  }

  const libraries = []
  const skipped = []
  const typeCounts: Record<string, number> = {}

  for (const record of records) {
    const mapped = mapGermanLibrary(record as GermanLibrary)
    if (typeof mapped === "string") {
      skipped.push({
        recordId: record.isil || "",
        name: record.name || "",
        reason: mapped,
      })
    } else {
      libraries.push(mapped)
      typeCounts[mapped.data.libraryType!] =
        (typeCounts[mapped.data.libraryType!] || 0) + 1
    }
  }

  return executeDirectoryIngest({
    args,
    directory: __dirname,
    dataset: "de-isil",
    inputs: sources.inputs,
    retrievedAt: snapshot.retrievedAt,
    sourceCount: records.length,
    libraries,
    skipped,
    details: {
      coverage: "All ISIL records with valid ISIL, name, and Land (Bundesland)",
      typeCounts,
      coordinatesIncluded: libraries.filter((l) => l.data.location).length,
    },
  })
}
