import { directoryPoint, directoryText, directoryUrl } from "./directory-fields"
import {
  array,
  at,
  columns,
  identity,
  object,
  type ExpansionCandidate,
  type SourceObject,
} from "./expansion-contract"

const text = (value: unknown) => {
  if (value != null && typeof value !== "string" && typeof value !== "number")
    throw new Error("Expected a source scalar")

  return directoryText(value)
}
const scalar = (value: unknown) => {
  const v = text(value)

  return v && v.length <= 255 ? v : undefined
}

export function candidate(
  id: string | undefined,
  nameValue: unknown,
  sourceUrl: string,
  fields: {
    address?: unknown
    city?: unknown
    postcode?: unknown
    phone?: unknown
    website?: unknown
    region?: unknown
    area?: unknown
    type?: string
    lat?: unknown
    lon?: unknown
    bounds?: [number, number, number, number]
  } = {}
): ExpansionCandidate {
  const name = scalar(nameValue)
  if (!id || !name) throw new Error("Source row has no usable name or identity")
  const warnings = [
    "Operation, visitor access and opening hours are unverified",
  ]
  const data: ExpansionCandidate["data"] = {
    libraryType: fields.type ?? "Other",
  }
  for (const [key, value] of Object.entries({
    streetAddress: fields.address,
    city: fields.city,
    postalCode: fields.postcode,
    phone: fields.phone,
  })) {
    const clean = scalar(value)
    if (clean) data[key] = clean
    else if (text(value))
      warnings.push(`${key} exceeds the CMS limit and was omitted`)
  }
  const website = directoryUrl(fields.website)
  if (website) data.website = website
  const point = fields.bounds
    ? directoryPoint(fields.lat, fields.lon, fields.bounds)
    : undefined
  if (!point) warnings.push("No approved source point available")
  if (/mobile|bibliobus|bibliobús|itinerante|books?\s*bus/i.test(name))
    warnings.push("Possible mobile service: exclude unless separately modelled")

  return {
    recordId: id,
    name,
    sourceUrl,
    data,
    point,
    warnings,
    regionHint: text(fields.region),
    areaHint: text(fields.area),
  }
}

/** A validated GeoJSON feature with optional point geometry. */
export type GeoFeature = {
  readonly id: unknown
  readonly properties: SourceObject
  readonly geometry?: { readonly coordinates: readonly unknown[] }
}

export function geoFeatures(raw: unknown): GeoFeature[] {
  const root = object(raw)
  if (root.type !== "FeatureCollection")
    throw new Error("Expected GeoJSON FeatureCollection")
  if (
    root.crs &&
    !/(?:4326|CRS84)/i.test(String(at(root.crs, "properties", "name") ?? ""))
  )
    throw new Error("GeoJSON must use WGS84")
  const features = array(root.features)
  for (const key of ["totalFeatures", "numberMatched", "numberReturned"])
    if (root[key] !== undefined && Number(root[key]) !== features.length)
      throw new Error(`Incomplete GeoJSON: ${key}`)

  return features.map((value) => {
    const f = object(value)
    const properties = object(f.properties)
    if (f.type !== "Feature") throw new Error("Invalid GeoJSON feature")
    const coordinates = at(f.geometry, "coordinates")
    if (
      f.geometry &&
      (at(f.geometry, "type") !== "Point" || !Array.isArray(coordinates))
    )
      throw new Error("Expected point geometry")

    return {
      ...f,
      id: f.id,
      properties,
      geometry: f.geometry
        ? { ...object(f.geometry), coordinates: coordinates as unknown[] }
        : undefined,
    }
  })
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

function decodeEntity(entity: string) {
  if (!entity.startsWith("#"))
    return NAMED_ENTITIES[entity.toLowerCase()] ?? `&${entity};`
  const point =
    entity[1].toLowerCase() === "x"
      ? Number.parseInt(entity.slice(2), 16)
      : Number(entity.slice(1))

  return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
    ? String.fromCodePoint(point)
    : ""
}

/**
 * Plain text of an NLB table cell. Entities are decoded in one pass so a
 * decoded `&` is never decoded again, and no angle bracket survives, so the
 * result can never carry markup.
 */
const decodeNlbCell = (v: string) =>
  v
    .replaceAll(/<[^<>]*>/g, "")
    .replaceAll(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|nbsp);/gi, (_, entity) =>
      decodeEntity(entity)
    )
    .replaceAll(/[<>]/g, "")
    .trim()

/** NLB embeds its attributes in an HTML table inside each GeoJSON feature. */
export function nlbAttributes(html: unknown): Record<string, string> {
  if (typeof html !== "string") throw new Error("Missing NLB Description table")
  const result: Record<string, string> = {}
  for (const match of html.matchAll(
    /<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/gi
  )) {
    const key = decodeNlbCell(match[1])
    if (Object.hasOwn(result, key))
      throw new Error(`Duplicate NLB attribute ${key}`)
    result[key] = decodeNlbCell(match[2])
  }
  columns(result, ["NAME", "ADDRESSSTREETNAME", "ADDRESSPOSTALCODE"])

  return result
}

export function syntheticId(parts: unknown[]) {
  return `derived-${identity(parts)}`
}

export function mapWikidata(
  raw: unknown,
  country: "Q55" | "Q664"
): ExpansionCandidate[] {
  const bindings = array(object(object(raw).results).bindings)
  const groups = new Map<string, SourceObject[]>()
  for (const rawRow of bindings) {
    const row = object(rawRow)
    if (
      !new RegExp(
        String.raw`^https?://www\.wikidata\.org/entity/${country}$`
      ).test(String(at(row, "country", "value") ?? ""))
    )
      throw new Error(
        "Wikidata row belongs to another country or lacks the country binding"
      )
    const qid = String(at(row, "library", "value") ?? "").match(
      /^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9]\d*)$/
    )?.[1]
    if (!qid) throw new Error("Invalid Wikidata identity")
    groups.set(qid, [...(groups.get(qid) ?? []), row])
  }

  return [...groups].map(([qid, rows]) => {
    const values = (field: string) =>
      [
        ...new Set(
          rows.map((r) => text(at(r, field, "value"))).filter(Boolean)
        ),
      ].sort()
    const names = values("libraryLabel").filter((v) => v !== qid)
    if (!names.length) throw new Error(`Wikidata ${qid} has no readable label`)
    const kinds = values("kind").map((v) => v.split("/").pop())
    const types = [
      ...new Set(
        kinds
          .map(
            (k) =>
              ({
                Q28564: "Public",
                Q1622062: "National",
                Q856234: "Academic",
                Q22806: "Other",
              })[k]
          )
          .filter(Boolean)
      ),
    ]
    const row = candidate(
      qid,
      names[0],
      `https://www.wikidata.org/wiki/${qid}`,
      {
        address:
          values("address").length === 1 ? values("address")[0] : undefined,
        website:
          values("website").length === 1 ? values("website")[0] : undefined,
        area: values("placeLabel").join(" | "),
        type: types.length === 1 ? types[0] : "Other",
      }
    )
    for (const field of ["libraryLabel", "address", "website", "kind"])
      if (values(field).length > 1)
        row.warnings.push(`Multiple ${field} values; review the entity`)
    row.warnings.push(
      "Coordinates intentionally excluded; current branch existence needs review"
    )

    return row
  })
}
