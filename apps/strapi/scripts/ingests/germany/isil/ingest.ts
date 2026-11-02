import path from "node:path"
import { gunzipSync } from "node:zlib"

import { mapGermanLibrary, type GermanLibrary } from "./map"
import { flag, type IngestArgs } from "../../_shared/cli"
import { executeDirectoryIngest } from "../../_shared/directory"
import { JsonSources } from "../../_shared/json-source"

const DUMP_URL = "https://data.dnb.de/opendata/bib_lds.jsonld.gz"

/**
 * Parse JSONLD to extract ISIL records.
 * The dump is a flat list of RDF triples in JSONLD compact format.
 */
function parseIsil(
  data: Record<string, unknown> | Record<string, unknown>[]
): Record<string, Partial<GermanLibrary>> {
  const records: Record<string, Partial<GermanLibrary>> = {}

  // Handle @graph (common in JSONLD)
  const items = data["@graph"] || (Array.isArray(data) ? data : [data])
  if (!Array.isArray(items)) {
    throw new TypeError("Unexpected JSONLD structure")
  }

  for (const item of items) {
    if (!item["@id"]) continue

    // Extract ISIL from record URI: https://ld.zdb-services.de/resource/organisations/DE-xxx
    const match = item["@id"].match(/organisations\/([A-Z]{2}-\d+)/)
    if (!match) continue
    const isil = match[1]

    if (!records[isil]) {
      records[isil] = { isil }
    }
    const rec = records[isil]

    // Map common fields from JSONLD
    if (item["http://xmlns.com/foaf/0.1/name"])
      rec.name = item["http://xmlns.com/foaf/0.1/name"][0]?.["@value"]
    if (item["http://xmlns.com/foaf/0.1/name"])
      rec.shortName =
        item["http://dbpedia.org/property/shortName"]?.[0]?.["@value"]

    // Address handling (v:adr structure)
    const addresses = item["http://www.w3.org/2006/vcard/ns#adr"] || []
    for (const addr of addresses) {
      // Look for visitor address type
      const type =
        addr["http://www.w3.org/2006/vcard/ns#hasAddressType"]?.[0]?.["@id"]
      if (type?.includes("visitor")) {
        rec.streetAddress =
          addr["http://www.w3.org/2006/vcard/ns#streetAddress"]?.[0]?.["@value"]
        rec.city =
          addr["http://www.w3.org/2006/vcard/ns#locality"]?.[0]?.["@value"]
        rec.postalCode =
          addr["http://www.w3.org/2006/vcard/ns#postalCode"]?.[0]?.["@value"]

        // Coordinates
        const geo = addr["http://www.w3.org/2003/01/geo/wgs84_pos#lat"]
        if (geo) {
          rec.latitude = Number(geo[0]?.["@value"])
          rec.longitude = Number(
            addr["http://www.w3.org/2003/01/geo/wgs84_pos#long"]?.[0]?.[
              "@value"
            ]
          )
        }
      }
    }

    // Phone, homepage
    if (item["http://www.w3.org/2006/vcard/ns#tel"])
      rec.phone = item["http://www.w3.org/2006/vcard/ns#tel"][0]?.["@value"]
    if (item["http://xmlns.com/foaf/0.1/homepage"])
      rec.website = item["http://xmlns.com/foaf/0.1/homepage"][0]?.["@id"]
    if (item["http://iflastandards.info/ns/isbd/terms/relation#opac"])
      rec.catalogueUrl =
        item["http://iflastandards.info/ns/isbd/terms/relation#opac"][0]?.[
          "@id"
        ]
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

  // Validate expected coverage
  if (records.length < 20000 || records.length > 26000) {
    throw new Error(
      `Unexpected German ISIL coverage ${records.length}; expected 20,000–26,000`
    )
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
