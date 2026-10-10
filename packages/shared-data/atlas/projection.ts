import { atlasCellId, atlasDisplayCoordinate } from "./cells"
import {
  ATLAS_LIMITS,
  ATLAS_OPERATOR_GROUPS,
  ATLAS_TYPE_GROUPS,
  type AtlasCellFields,
  type AtlasCoordinate,
  type AtlasLibrarySource,
  type AtlasOperatorGroup,
  type AtlasOptionKind,
  type AtlasProjection,
  type AtlasTypeGroup,
  type AtlasPoint,
} from "./contracts"
import { atlasHoursProjection, atlasTimezone } from "./hours"
import { atlasCityKey, atlasNameSortKey, atlasPlaceSortKey } from "./sort-keys"

export function atlasTypeGroup(
  value: string | null | undefined
): AtlasTypeGroup {
  return (
    (Object.keys(ATLAS_TYPE_GROUPS) as AtlasTypeGroup[]).find((key) =>
      (ATLAS_TYPE_GROUPS[key] as readonly string[]).includes(value ?? "")
    ) ?? "other"
  )
}
export function atlasOperatorGroup(
  value: string | null | undefined
): AtlasOperatorGroup | null {
  return (
    (Object.keys(ATLAS_OPERATOR_GROUPS) as AtlasOperatorGroup[]).find((key) =>
      (ATLAS_OPERATOR_GROUPS[key] as readonly string[]).includes(value ?? "")
    ) ?? null
  )
}
export function atlasOptionCode(
  kind: AtlasOptionKind,
  documentId: string
): string {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(documentId))
    throw new RangeError("Invalid Atlas option ID")

  return `${kind}:${documentId}`
}
export function atlasYear(
  value: string | number | null | undefined
): number | null {
  const match =
    value === null || value === undefined ? null : /\d{3,4}/.exec(String(value))

  return match ? Number(match[0]) : null
}

/** Called in the external worker; no CMS, database or renderer imports. */
export function projectAtlasLibrary(
  source: AtlasLibrarySource,
  options: { atlasId: number; canonicalLocale: string; now: Date }
): AtlasProjection | null {
  if (!Number.isSafeInteger(options.atlasId) || options.atlasId < 1)
    throw new RangeError("Invalid Atlas ID")
  if (!source.published || source.locale !== options.canonicalLocale)
    return null
  const coordinate = atlasDisplayCoordinate(source.location)
  if (!coordinate) return null
  const original = source.location as AtlasCoordinate
  const access_codes = [
    ...new Set(
      (source.accessibility ?? []).map((o) =>
        atlasOptionCode("access", o.documentId)
      )
    ),
  ].sort()
  const facility_codes = [
    ...new Set([
      ...access_codes,
      ...(source.services ?? []).map((o) =>
        atlasOptionCode("service", o.documentId)
      ),
      ...(source.amenities ?? []).map((o) =>
        atlasOptionCode("amenity", o.documentId)
      ),
    ]),
  ].sort()
  const open_tz = atlasTimezone(source.timezone)
  const cells = Object.fromEntries(
    Array.from({ length: ATLAS_LIMITS.maxCellZoom + 1 }, (_, z) => [
      `atlas_cell_${z}`,
      atlasCellId(coordinate, z),
    ])
  ) as AtlasCellFields

  return {
    ...cells,
    atlas_id: options.atlasId,
    documentId: source.documentId,
    locale: options.canonicalLocale,
    name: source.name,
    slug: source.slug,
    path:
      source.continent?.slug && source.country?.slug && source.region?.slug
        ? `/${source.continent.slug}/${source.country.slug}/${source.region.slug}/${source.slug}`
        : null,
    type_group: atlasTypeGroup(source.libraryType),
    operator_group: atlasOperatorGroup(source.operatorType),
    status: source.operationalStatus ?? "unknown",
    listed:
      source.operationalStatus !== "permanently_closed" &&
      !(source.libraryType === "Mobile" && source.mobileTimetable != null),
    access_listed: source.operationalStatus !== "permanently_closed",
    city: source.city ?? null,
    city_key: atlasCityKey(
      source.city,
      source.region?.documentId ?? source.country?.documentId ?? null
    ),
    continent_id: source.continent?.documentId ?? null,
    continent_slug: source.continent?.slug ?? null,
    continent_name: source.continent?.name ?? null,
    country_id: source.country?.documentId ?? null,
    country_slug: source.country?.slug ?? null,
    country_name: source.country?.name ?? null,
    region_id: source.region?.documentId ?? null,
    region_slug: source.region?.slug ?? null,
    region_name: source.region?.name ?? null,
    area_id: source.area?.documentId ?? null,
    area_slug: source.area?.slug ?? null,
    area_name: source.area?.name ?? null,
    latitude: coordinate.lat,
    longitude: coordinate.lng,
    original_lat: original.lat,
    original_lng: original.lng,
    _geo: coordinate,
    access_codes,
    facility_codes,
    has_access: access_codes.length > 0,
    open_tz,
    has_events: source.hasActiveFeed === true,
    has_catalogue: Boolean(source.catalogueUrl),
    founded: atlasYear(source.foundedYear) ?? atlasYear(source.openedYear),
    completeness:
      typeof source.completeness === "number" &&
      Number.isFinite(source.completeness)
        ? Math.max(0, Math.min(100, source.completeness))
        : null,
    ...atlasHoursProjection(
      source.openingTimes,
      source.notices ?? [],
      open_tz,
      options.now
    ),
    name_sort: atlasNameSortKey(source.name),
    place_sort: atlasPlaceSortKey(
      source.city ?? source.region?.name ?? "",
      source.name
    ),
  }
}

export function atlasPoint(record: AtlasProjection): AtlasPoint {
  const wrapped = (codes: string[]) =>
    codes.length ? `,${codes.join(",")},` : ""

  return {
    type: "Feature",
    id: record.atlas_id,
    geometry: {
      type: "Point",
      coordinates: [record.longitude, record.latitude],
    },
    properties: {
      i: record.documentId,
      s: record.slug,
      n: Array.from(record.name).slice(0, 240).join(""),
      t: record.type_group,
      o: record.operator_group,
      st: record.status,
      v: record.listed || record.status === "permanently_closed",
      ct: record.continent_id,
      co: record.country_id,
      r: record.region_id,
      ar: record.area_id,
      ci: record.city_key,
      a: wrapped(record.access_codes),
      f: wrapped(record.facility_codes),
      e: record.has_events,
      c: record.has_catalogue,
      l: record.late_sunday,
      y: record.founded,
      p: record.completeness,
    },
  }
}
