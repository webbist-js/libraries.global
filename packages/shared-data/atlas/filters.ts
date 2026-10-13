import { atlasBoundsRanges, atlasInBounds } from "./cells"
import {
  ATLAS_LIMITS,
  ATLAS_OPERATOR_GROUPS,
  ATLAS_TYPE_GROUPS,
  type AtlasDictionary,
  type AtlasOptionKind,
  type AtlasPopulation,
  type AtlasProjection,
  type AtlasScope,
  type AtlasTileProperties,
} from "./contracts"
import {
  atlasOpenAtFilter,
  atlasOpenNowFilter,
  atlasProjectionOpenAt,
  atlasProjectionOpenNow,
} from "./hours"

type CodeGroups = string[][]

export interface AtlasResolvedScope {
  scope: AtlasScope
  facilities: CodeGroups
  access: CodeGroups
}

/** Exact names and retained aliases preserve existing name-based links. */
export function atlasResolveOptions(
  names: readonly string[],
  dictionary: AtlasDictionary,
  kinds: readonly AtlasOptionKind[]
): CodeGroups {
  return [...new Set(names)]
    .sort()
    .map((name) =>
      [
        ...new Set(
          dictionary.entries
            .filter(
              (entry) =>
                kinds.includes(entry.kind) &&
                (entry.name === name || entry.aliases.includes(name))
            )
            .map((entry) => entry.code)
        ),
      ].sort()
    )
}
export function atlasResolveScope(
  scope: AtlasScope,
  dictionary: AtlasDictionary
): AtlasResolvedScope {
  return {
    scope,
    facilities: atlasResolveOptions(scope.filters.facilities, dictionary, [
      "access",
      "service",
      "amenity",
    ]),
    access: atlasResolveOptions(scope.accessibility.selected, dictionary, [
      "access",
    ]),
  }
}
const hasAll = (codes: readonly string[], groups: CodeGroups): boolean =>
  groups.every((group) => group.some((code) => codes.includes(code)))

export function atlasAccessMembership(
  record: AtlasProjection,
  groups: CodeGroups
): { matches: boolean; partial: boolean; unconfirmed: boolean } {
  const matches = groups.length
    ? hasAll(record.access_codes, groups)
    : record.has_access
  const any = groups.length
    ? groups.some((group) =>
        group.some((code) => record.access_codes.includes(code))
      )
    : matches

  return { matches, partial: any && !matches, unconfirmed: !matches }
}
const placeField = {
  continent: "continent_id",
  country: "country_id",
  region: "region_id",
  area: "area_id",
  city: "city_key",
} as const
const tilePlaceField = {
  continent: "ct",
  country: "co",
  region: "r",
  area: "ar",
  city: "ci",
} as const

export function atlasMatchesProjection(
  record: AtlasProjection,
  resolved: AtlasResolvedScope,
  now: Date,
  population: AtlasPopulation = "listed"
): boolean {
  const { scope, facilities, access } = resolved
  const { filters: f, accessibility: a } = scope
  if (scope.bbox && !atlasInBounds(record._geo, scope.bbox)) return false
  if (scope.place && record[placeField[scope.place.level]] !== scope.place.id)
    return false
  if (population === "closures") return record.status === "permanently_closed"
  if (
    !record.listed ||
    (f.types.length && !f.types.includes(record.type_group)) ||
    (f.operators.length &&
      (!record.operator_group ||
        !f.operators.includes(record.operator_group))) ||
    !hasAll(record.facility_codes, facilities) ||
    (f.events && !record.has_events) ||
    (f.catalogue && !record.has_catalogue) ||
    (f.founded &&
      (record.founded === null ||
        record.founded < f.founded[0] ||
        record.founded > f.founded[1]))
  )
    return false
  if (
    f.opening === "at" &&
    !atlasProjectionOpenAt(record, f.atDay, f.atMinutes)
  )
    return false
  if (
    (f.opening === "now" || f.opening === "staff_now") &&
    !atlasProjectionOpenNow(record, now, f.opening === "staff_now")
  )
    return false
  if (a.enabled && a.view !== "compare") {
    const membership = atlasAccessMembership(record, access)
    if (a.view === "matches" ? !membership.matches : !membership.unconfirmed)
      return false
  }

  return (
    (population !== "events" || record.has_events) &&
    (population !== "late" || record.late_sunday)
  )
}

const quote = (value: unknown): string => JSON.stringify(value)
const groupsFilter = (field: string, groups: CodeGroups): string[] =>
  groups.map((group) =>
    group.length ? `${field} IN ${quote(group)}` : "atlas_id < 0"
  )

export function atlasAccessFilter(
  resolved: AtlasResolvedScope,
  membership: "matches" | "any" = "matches"
): string {
  const groups = groupsFilter("access_codes", resolved.access)
  if (!groups.length) return "has_access = true"

  return `(${groups.join(membership === "matches" ? " AND " : " OR ")})`
}
export function atlasMeiliFilter(
  resolved: AtlasResolvedScope,
  options: {
    now: Date
    timezones: readonly string[]
    population?: AtlasPopulation
    ignoreAccessView?: boolean
    libraryAccess?: boolean
  }
): string {
  const { scope, facilities } = resolved
  const { filters: f, accessibility: a } = scope
  const population = options.population ?? "listed"
  const conditions: string[] = [
    population === "closures"
      ? 'status = "permanently_closed"'
      : options.libraryAccess
        ? "access_listed = true"
        : "listed = true",
  ]
  if (scope.bbox) {
    conditions.push(
      `(${atlasBoundsRanges(scope.bbox)
        .map(
          (b) =>
            `(latitude >= ${b.south} AND latitude <= ${b.north} AND longitude >= ${b.west} AND longitude <= ${b.east})`
        )
        .join(" OR ")})`
    )
  }
  if (scope.place)
    conditions.push(
      `${placeField[scope.place.level]} = ${quote(scope.place.id)}`
    )
  if (population === "closures") return conditions.join(" AND ")
  if (f.types.length) conditions.push(`type_group IN ${quote(f.types)}`)
  if (f.operators.length)
    conditions.push(`operator_group IN ${quote(f.operators)}`)
  conditions.push(...groupsFilter("facility_codes", facilities))
  if (f.events || population === "events") conditions.push("has_events = true")
  if (f.catalogue) conditions.push("has_catalogue = true")
  if (population === "late") conditions.push("late_sunday = true")
  if (f.founded)
    conditions.push(
      `(founded >= ${f.founded[0]} AND founded <= ${f.founded[1]})`
    )
  if (f.opening === "at")
    conditions.push(atlasOpenAtFilter(f.atDay, f.atMinutes))
  if (f.opening === "now" || f.opening === "staff_now")
    conditions.push(
      atlasOpenNowFilter(
        options.timezones,
        options.now,
        f.opening === "staff_now"
      )
    )
  if (a.enabled && a.view !== "compare" && !options.ignoreAccessView) {
    const access = atlasAccessFilter(resolved)
    conditions.push(a.view === "gaps" ? `NOT (${access})` : access)
  }

  return conditions.join(" AND ")
}

/** MapLibre expression. Dynamic hours require complete current-query geometry. */
export type AtlasMapExpression = unknown[]
export function atlasTileFilter(
  resolved: AtlasResolvedScope,
  population: AtlasPopulation = "listed"
): AtlasMapExpression {
  const { scope, facilities, access } = resolved
  const { filters: f, accessibility: a } = scope
  const conditions: AtlasMapExpression[] = [
    ["!=", ["get", "v"], false],
    population === "closures"
      ? ["==", ["get", "st"], "permanently_closed"]
      : ["!=", ["get", "st"], "permanently_closed"],
  ]
  if (scope.place)
    conditions.push([
      "==",
      ["get", tilePlaceField[scope.place.level]],
      scope.place.id,
    ])
  if (population === "closures") return ["all", ...conditions]
  if (f.opening !== "any")
    throw new RangeError(
      "Dynamic Atlas hours cannot use static tile predicates"
    )
  const include = (key: keyof AtlasTileProperties, values: string[]) =>
    conditions.push(["in", ["get", key], ["literal", values]])
  if (f.types.length) include("t", f.types)
  if (f.operators.length) include("o", f.operators)
  const codeGroup = (key: "a" | "f", group: string[]): AtlasMapExpression =>
    group.length
      ? ["any", ...group.map((code) => ["in", `,${code},`, ["get", key]])]
      : ["==", 1, 0]
  conditions.push(...facilities.map((group) => codeGroup("f", group)))
  if (f.events || population === "events")
    conditions.push(["==", ["get", "e"], true])
  if (f.catalogue) conditions.push(["==", ["get", "c"], true])
  if (population === "late") conditions.push(["==", ["get", "l"], true])
  if (f.founded)
    conditions.push([
      "all",
      ["!=", ["get", "y"], null],
      [">=", ["get", "y"], f.founded[0]],
      ["<=", ["get", "y"], f.founded[1]],
    ])
  if (a.enabled && a.view !== "compare") {
    const match: AtlasMapExpression = access.length
      ? ["all", ...access.map((group) => codeGroup("a", group))]
      : ["!=", ["get", "a"], ""]
    conditions.push(a.view === "gaps" ? ["!", match] : match)
  }

  return ["all", ...conditions]
}

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new RangeError("Invalid Atlas scope object")

  return value as Record<string, unknown>
}
function number(
  value: unknown,
  low: number,
  high: number,
  integer = false
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < low ||
    value > high ||
    (integer && !Number.isInteger(value))
  )
    throw new RangeError("Invalid Atlas numeric input")

  return value
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new RangeError("Invalid Atlas boolean input")

  return value
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T))
    throw new RangeError("Invalid Atlas enum input")

  return value as T
}
function strings(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > ATLAS_LIMITS.selectedOptions ||
    value.some(
      (v) =>
        typeof v !== "string" ||
        !v.trim() ||
        v.length > ATLAS_LIMITS.optionNameLength ||
        Array.from(v as string).some((c) => c.codePointAt(0)! < 32)
    )
  )
    throw new RangeError("Invalid Atlas option selection")

  return [...new Set(value as string[])].sort()
}

/** Reject unknown fields, raw filters, coercions and over-budget selections. */
export function parseAtlasScope(input: unknown): AtlasScope {
  const value = object(input, ["bbox", "place", "filters", "accessibility"])
  const f = object(value.filters, [
    "types",
    "opening",
    "atDay",
    "atMinutes",
    "operators",
    "facilities",
    "events",
    "catalogue",
    "founded",
  ])
  const a = object(value.accessibility, ["enabled", "selected", "view"])
  let founded: [number, number] | null = null
  if (f.founded !== null) {
    if (!Array.isArray(f.founded) || f.founded.length !== 2)
      throw new RangeError("Invalid Atlas year range")
    founded = [
      number(f.founded[0], 0, 9999, true),
      number(f.founded[1], 0, 9999, true),
    ]
    if (founded[0] > founded[1])
      throw new RangeError("Invalid Atlas year range")
  }
  const scope: AtlasScope = {
    filters: {
      types: strings(f.types).map((v) =>
        choice(
          v,
          Object.keys(ATLAS_TYPE_GROUPS) as (keyof typeof ATLAS_TYPE_GROUPS)[]
        )
      ),
      opening: choice(f.opening, ["any", "now", "staff_now", "at"]),
      atDay: number(f.atDay, 0, 6, true),
      atMinutes: number(f.atMinutes, 0, 1439, true),
      operators: strings(f.operators).map((v) =>
        choice(
          v,
          Object.keys(
            ATLAS_OPERATOR_GROUPS
          ) as (keyof typeof ATLAS_OPERATOR_GROUPS)[]
        )
      ),
      facilities: strings(f.facilities),
      events: boolean(f.events),
      catalogue: boolean(f.catalogue),
      founded,
    },
    accessibility: {
      enabled: boolean(a.enabled),
      selected: strings(a.selected),
      view: choice(a.view, ["matches", "compare", "gaps"]),
    },
  }
  if (value.bbox !== undefined) {
    const b = object(value.bbox, ["west", "east", "south", "north"])
    scope.bbox = {
      west: number(b.west, -1080, 1080),
      east: number(b.east, -1080, 1080),
      south: number(b.south, -90, 90),
      north: number(b.north, -90, 90),
    }
    atlasBoundsRanges(scope.bbox)
  }
  if (value.place !== undefined) {
    const p = object(value.place, ["level", "id"])
    if (
      typeof p.id !== "string" ||
      p.id.length === 0 ||
      p.id.length > ATLAS_LIMITS.placeKeyLength ||
      Array.from(p.id).some((character) => character.codePointAt(0)! < 32)
    )
      throw new RangeError("Invalid Atlas place key")
    const id = p.id
    scope.place = {
      level: choice(p.level, [
        "continent",
        "country",
        "region",
        "area",
        "city",
      ]),
      id: id!,
    }
  }

  return scope
}
