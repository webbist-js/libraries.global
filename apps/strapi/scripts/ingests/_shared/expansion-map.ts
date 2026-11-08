import { directoryPoint, directoryText, directoryUrl } from "./directory-fields"
import {
  array,
  columns,
  identity,
  object,
  type ExpansionCandidate,
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

export function geoFeatures(raw: unknown) {
  const root = object(raw)
  if (root.type !== "FeatureCollection")
    throw new Error("Expected GeoJSON FeatureCollection")
  if (root.crs && !/(?:4326|CRS84)/i.test(root.crs.properties?.name ?? ""))
    throw new Error("GeoJSON must use WGS84")
  const features = array(root.features)
  for (const key of ["totalFeatures", "numberMatched", "numberReturned"])
    if (root[key] !== undefined && Number(root[key]) !== features.length)
      throw new Error(`Incomplete GeoJSON: ${key}`)

  return features.map((f) => {
    object(f)
    object(f.properties)
    if (f.type !== "Feature") throw new Error("Invalid GeoJSON feature")
    if (
      f.geometry &&
      (f.geometry.type !== "Point" || !Array.isArray(f.geometry.coordinates))
    )
      throw new Error("Expected point geometry")

    return f
  })
}

/** NLB embeds its attributes in an HTML table inside each GeoJSON feature. */
export function nlbAttributes(html: unknown): Record<string, string> {
  if (typeof html !== "string") throw new Error("Missing NLB Description table")
  const decode = (v: string) =>
    v
      .replaceAll(/<[^>]*>/g, "")
      .replaceAll(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
        const point =
          n[0].toLowerCase() === "x"
            ? Number.parseInt(n.slice(1), 16)
            : Number(n)

        return point > 0 &&
          point <= 0x10ffff &&
          !(point >= 0xd800 && point <= 0xdfff)
          ? String.fromCodePoint(point)
          : ""
      })
      .replaceAll("&amp;", "&")
      .replaceAll("&quot;", '"')
      .replaceAll(/&#39;|&apos;/g, "'")
      .replaceAll("&nbsp;", " ")
      .trim()
  const result: Record<string, string> = {}
  for (const match of html.matchAll(
    /<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/gi
  )) {
    const key = decode(match[1])
    if (Object.hasOwn(result, key))
      throw new Error(`Duplicate NLB attribute ${key}`)
    result[key] = decode(match[2])
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
  const groups = new Map<string, Record<string, any>[]>()
  for (const rawRow of bindings) {
    const row = object(rawRow)
    if (
      !new RegExp(
        String.raw`^https?://www\.wikidata\.org/entity/${country}$`
      ).test(row.country?.value ?? "")
    )
      throw new Error(
        "Wikidata row belongs to another country or lacks the country binding"
      )
    const qid = String(row.library?.value ?? "").match(
      /^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9]\d*)$/
    )?.[1]
    if (!qid) throw new Error("Invalid Wikidata identity")
    groups.set(qid, [...(groups.get(qid) ?? []), row])
  }

  return [...groups].map(([qid, rows]) => {
    const values = (field: string) =>
      [
        ...new Set(rows.map((r) => text(r[field]?.value)).filter(Boolean)),
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
