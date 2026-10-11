import { NORDICS, type Binding, type NordicCountry } from "./source"
import type { PipelineLibrary } from "../_shared/execute"
import type { SourcePlace } from "../_shared/geography"
import { slugify } from "../_shared/text"

export interface SkippedLibrary {
  recordId: string
  name: string
  reason: string
}
const entityId = (value: string) =>
  value.match(/^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9]\d*)$/)?.[1]

/** Several SPARQL rows can describe one institution; identities are never row numbers. */
export function mapWikidata(
  rows: Binding[],
  country: NordicCountry,
  geography: SourcePlace[]
) {
  const groups = new Map<string, Binding[]>()
  for (const row of rows) {
    const id = entityId(row.library?.value ?? "")
    if (!id) throw new Error("Invalid Wikidata library identifier")
    const group = groups.get(id) ?? []
    group.push(row)
    groups.set(id, group)
  }
  const libraries: PipelineLibrary[] = [],
    skipped: SkippedLibrary[] = []
  const areas = geography.filter(
    (p) => p.country === country && p.level === "area"
  )
  const bounds =
    country === "SE"
      ? [55, 70, 10, 25]
      : country === "NO"
        ? [57, 72, 4, 32]
        : [54, 58, 7, 16]
  for (const [recordId, group] of groups) {
    const values = (field: string) => [
      ...new Set(
        group
          .flatMap((row) => (row[field] ? [row[field].value.trim()] : []))
          .filter(Boolean)
      ),
    ]
    const names = values("libraryLabel")
    if (names.length !== 1)
      throw new Error(`Conflicting library names: ${recordId}`)
    const name = names[0]
    if (name === recordId) {
      skipped.push({ recordId, name, reason: "No readable library name" })
      continue
    }
    if (name.length > 255) {
      skipped.push({
        recordId,
        name,
        reason:
          "Library name exceeds the CMS string field limit; needs editorial abbreviation",
      })
      continue
    }
    const codes = values("areaCode")
    const matches = areas.filter((p) => codes.includes(p.code))
    if (matches.length > 1) {
      skipped.push({
        recordId,
        name,
        reason: `Multiple current municipalities: ${matches.map((p) => p.code).join(", ")}`,
      })
      continue
    }
    const area = matches[0]
    const warnings: string[] = [
      "Wikidata knowledge-graph record; current operation, visitor access and contact details need contributor verification",
    ]
    const kinds = new Set(values("kind").map((value) => entityId(value)))
    const libraryType = kinds.has("Q720920")
      ? "Mobile"
      : kinds.has("Q22806")
        ? "National"
        : kinds.has("Q1622062")
          ? "University"
          : kinds.has("Q856234") || kinds.has("Q1438040")
            ? "Academic"
            : kinds.has("Q28564")
              ? "Public"
              : kinds.has("Q385994")
                ? "Special"
                : "Other"
    if (libraryType === "Mobile")
      warnings.push(
        "Mobile library: municipality and map pin describe a base or service area, not a verified stop or timetable"
      )
    const data: PipelineLibrary["data"] = {
      name,
      slug: `${slugify(name).slice(0, 220).replace(/-+$/, "")}-${country.toLowerCase()}-${recordId.toLowerCase()}`,
      source: "wikidata",
      sourceUrl: `https://www.wikidata.org/wiki/${recordId}`,
      libraryType,
      operationalStatus: "unknown",
      timezone: NORDICS[country].timezone,
    }
    const coordinates = values("coord").flatMap((value) => {
      const point = value.match(
        /^Point\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/
      )
      if (!point) return []
      const lng = Number(point[1]),
        lat = Number(point[2])
      if (
        lat < bounds[0] ||
        lat > bounds[1] ||
        lng < bounds[2] ||
        lng > bounds[3]
      )
        return []

      return [{ lat, lng }]
    })
    if (coordinates.length === 1) data.location = coordinates[0]
    else
      warnings.push(
        coordinates.length
          ? "Multiple map pins omitted"
          : "Missing or invalid coordinates; contributor can add a map pin"
      )
    if (!area)
      warnings.push(
        codes.length
          ? "Source municipality codes do not match current boundaries; country placement only"
          : "No municipality claim; country placement only"
      )
    const websites = values("website").flatMap((value) => {
      try {
        const url = new URL(value)

        return ["http:", "https:"].includes(url.protocol) &&
          url.toString().length <= 255
          ? [url.toString()]
          : []
      } catch {
        return []
      }
    })
    if (websites.length === 1) data.website = websites[0]
    else if (values("website").length)
      warnings.push("Invalid or multiple websites omitted")
    if (values("website").some((value) => value.length > 255))
      warnings.push(
        "Website exceeds the CMS field limit; omitted instead of truncating the URL"
      )
    // P6375 is a full address, not a separately verified street/postal/city tuple.
    const addresses = group.filter(
      (row) =>
        row.address &&
        (!row.address["xml:lang"] ||
          NORDICS[country].language
            .split(",")
            .includes(row.address["xml:lang"]!))
    )
    const addressValues = [
      ...new Set(
        addresses.map((row) => row.address.value.trim()).filter(Boolean)
      ),
    ]
    if (addressValues.length === 1 && addressValues[0].length <= 255)
      data.streetAddress = addressValues[0]
    else if (addressValues.some((value) => value.length > 255))
      warnings.push("Full address exceeds the CMS field limit; omitted")
    if (!area && !data.location) {
      skipped.push({
        recordId,
        name,
        reason: "No current municipality or usable physical location",
      })
      continue
    }
    libraries.push({
      recordId,
      countryKey: country,
      ...(area ? { areaKey: area.key } : {}),
      data,
      warnings,
    })
  }

  return { libraries, skipped, sourceCount: groups.size }
}
