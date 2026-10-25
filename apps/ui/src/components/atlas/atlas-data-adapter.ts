import {
  ATLAS_TYPE_GROUPS,
  ATLAS_OPERATOR_GROUPS,
  type AtlasListRow,
  type AtlasProjection,
  type AtlasPoint,
  type AtlasDictionary,
} from "@repo/shared-data"

import type { AtlasLibrary } from "./atlas.logic"

const base = (): Pick<
  AtlasLibrary,
  | "tz"
  | "hours"
  | "founded"
  | "closed"
  | "events"
  | "catalogue"
  | "access"
  | "services"
  | "complete"
  | "operator"
> => ({
  tz: null,
  hours: null,
  founded: null,
  closed: null,
  events: false,
  catalogue: false,
  access: [],
  services: [],
  complete: 0,
  operator: null,
})

export function atlasListLibrary(row: AtlasListRow): AtlasLibrary {
  return {
    ...base(),
    networkIds: "network_ids" in row ? (row.network_ids as string[]) : [],
    id: row.documentId,
    slug: row.slug,
    name: row.name,
    type: ATLAS_TYPE_GROUPS[row.type][0],
    status: row.status,
    tz: row.timezone,
    hours: row.hours,
    atlasOpenNow: row.openNow,
    access: row.accessibility,
    complete: row.completeness ?? 0,
    city: row.city,
    country: row.country,
    region: row.region,
    path: row.path,
    lat: row.coordinate.lat,
    lng: row.coordinate.lng,
  }
}
export function atlasPointLibrary(
  point: AtlasPoint,
  dictionary: AtlasDictionary
): AtlasLibrary {
  const p = point.properties
  const names = (key: "a" | "f") =>
    dictionary.entries
      .filter((e) => p[key].includes(`,${e.code},`))
      .map((e) => e.name)

  return {
    ...base(),
    networkIds: (p.nw ?? "").split(",").filter(Boolean),
    id: p.i,
    slug: p.s,
    name: p.n,
    type: ATLAS_TYPE_GROUPS[p.t][0],
    status: p.st,
    city: null,
    country: null,
    region: null,
    path: null,
    lat: point.geometry.coordinates[1],
    lng: point.geometry.coordinates[0],
    access: names("a"),
    services: names("f"),
    events: p.e,
    catalogue: p.c,
    complete: p.p ?? 0,
    founded: p.y,
    atlasLate: p.l,
  }
}
export function atlasProjectionLibrary(row: AtlasProjection): AtlasLibrary {
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
  const hours = days.map((day) =>
    Array.from({ length: 10 }, (_, n) => {
      const start = row[`regular_open_${day}_${n}_from`],
        end = row[`regular_open_${day}_${n}_to`]

      return start === undefined || end === undefined ? [] : [[start, end]]
    }).flat()
  )

  return {
    ...base(),
    networkIds: "network_ids" in row ? (row.network_ids as string[]) : [],
    id: row.documentId,
    slug: row.slug,
    name: row.name,
    type: ATLAS_TYPE_GROUPS[row.type_group][0],
    status: row.status,
    city: row.city,
    country: row.country_name,
    region: row.region_name,
    path: row.path,
    lat: row.latitude,
    lng: row.longitude,
    tz: row.open_tz,
    hours: row.has_hours ? hours : null,
    founded: row.founded,
    complete: row.completeness ?? 0,
    events: row.has_events,
    catalogue: row.has_catalogue,
    operator: row.operator_group
      ? ATLAS_OPERATOR_GROUPS[row.operator_group][0]
      : null,
    atlasLate: row.late_sunday,
  }
}
