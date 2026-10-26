import {
  ATLAS_LIMITS,
  ATLAS_SCHEMA_VERSION,
  ATLAS_LIST_SORTS,
  type AtlasSort,
  type AtlasCoordinate,
  type AtlasPopulation,
  type AtlasQueryRequest,
} from "./contracts"
import { parseAtlasScope } from "./filters"

function boundedString(value: unknown, limit: number): string {
  if (
    typeof value !== "string" ||
    value.length > limit ||
    Array.from(value).some((c) => c.codePointAt(0)! < 32)
  )
    throw new RangeError("Invalid Atlas text input")

  return value
}
function boundedNumber(
  value: unknown,
  min: number,
  max: number,
  integer = false
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new RangeError("Invalid Atlas numeric input")

  return value
}
function centre(input: unknown): AtlasCoordinate {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !["lat", "lng"].includes(k))
  )
    throw new RangeError("Invalid Atlas camera centre")
  const p = input as Record<string, unknown>

  return {
    lat: boundedNumber(p.lat, -90, 90),
    lng: boundedNumber(p.lng, -1080, 1080),
  }
}

/** Purpose-specific allowlists keep search inputs bounded and server-owned. */
export function parseAtlasQueryRequest(input: unknown): AtlasQueryRequest {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new RangeError("Invalid Atlas request")
  const r = input as Record<string, unknown>
  if (r.schemaVersion !== ATLAS_SCHEMA_VERSION)
    throw new RangeError("Unsupported Atlas schema version")
  const scope = parseAtlasScope(r.scope)
  const base = { schemaVersion: ATLAS_SCHEMA_VERSION, scope } as const
  let keys: string[] = []
  let result: AtlasQueryRequest
  switch (r.purpose) {
    case "libraryAccess":
      if (scope.bbox || scope.place)
        throw new RangeError("Library access requires whole reporting areas")
      if (!["countries", "local"].includes(String(r.level)))
        throw new RangeError("Invalid library access level")
      keys = ["level"]
      result = {
        ...base,
        purpose: "libraryAccess",
        level: r.level as "countries" | "local",
      }
      break
    case "perCapita":
      if (scope.bbox || scope.place)
        throw new RangeError("Per-capita comparisons require whole countries")
      result = { ...base, purpose: "perCapita" }
      break
    case "viewport": {
      if (!scope.bbox) throw new RangeError("Atlas viewport requires bounds")
      keys = [
        "zoom",
        "width",
        "height",
        "centre",
        "populations",
        "archiveBuildId",
        "drawingPreference",
        "quality",
        "density",
        "libraryDensity",
      ]
      const populations = ["listed", "closures", "events", "late"]
      if (
        !Array.isArray(r.populations) ||
        !r.populations.length ||
        r.populations.length > populations.length ||
        r.populations.some((p) => !populations.includes(p))
      )
        throw new RangeError("Invalid Atlas populations")
      if (!["auto", "current"].includes(String(r.drawingPreference)))
        throw new RangeError("Invalid Atlas drawing preference")
      result = {
        ...base,
        purpose: "viewport",
        zoom: boundedNumber(r.zoom, 0, 24),
        width: boundedNumber(r.width, 1, 8192, true),
        height: boundedNumber(r.height, 1, 8192, true),
        centre: centre(r.centre),
        populations: [...new Set(r.populations as AtlasPopulation[])].sort(),
        drawingPreference: r.drawingPreference as "auto" | "current",
      }
      if (r.archiveBuildId !== undefined)
        result.archiveBuildId = boundedString(r.archiveBuildId, 200)
      if (r.quality !== undefined) {
        if (typeof r.quality !== "boolean")
          throw new RangeError("Invalid Atlas quality request")
        result.quality = r.quality
      }
      if (r.density !== undefined) {
        if (typeof r.density !== "boolean")
          throw new RangeError("Invalid Atlas density request")
        result.density = r.density
      }
      if (r.libraryDensity !== undefined) {
        const d = r.libraryDensity as Record<string, unknown>
        if (
          !d ||
          typeof d !== "object" ||
          Array.isArray(d) ||
          Object.keys(d).some((key) => !["detail", "scale"].includes(key)) ||
          !["auto", 6, 10, 14, 18].includes(d.detail as string | number) ||
          !["fixed", "local"].includes(String(d.scale))
        )
          throw new RangeError("Invalid library density settings")
        result.libraryDensity = {
          detail: d.detail as NonNullable<
            typeof result.libraryDensity
          >["detail"],
          scale: d.scale as "fixed" | "local",
        }
      }
      break
    }
    case "list":
      if (!scope.bbox || !ATLAS_LIST_SORTS.includes(r.sort as AtlasSort))
        throw new RangeError("Invalid Atlas list scope or sort")
      keys = ["sort", "centre", "cursor", "page"]
      result = {
        ...base,
        purpose: "list",
        sort: r.sort as AtlasSort,
        centre: centre(r.centre),
      }
      if (r.sort === "distance") {
        if (r.cursor !== undefined)
          throw new RangeError("Distance pagination requires a page")
        if (r.page !== undefined)
          result.page = boundedNumber(
            r.page,
            0,
            ATLAS_LIMITS.reachableDistanceRows / ATLAS_LIMITS.listRows - 1,
            true
          )
      } else {
        if (r.page !== undefined)
          throw new RangeError("Ordered pagination requires a cursor")
        if (r.cursor !== undefined)
          result.cursor = boundedString(r.cursor, ATLAS_LIMITS.cursorBytes)
      }
      break

    case "search":
      if (scope.bbox) throw new RangeError("Atlas text search uses world scope")
      keys = ["q"]
      result = {
        ...base,
        purpose: "search",
        q: boundedString(r.q, ATLAS_LIMITS.searchLength).trim(),
      }
      break
    case "extent":
      if (scope.bbox)
        throw new RangeError("Atlas extent uses world or place scope")
      keys = ["centre"]
      result = { ...base, purpose: "extent", centre: centre(r.centre) }
      break
    case "counts":
      if (scope.bbox) throw new RangeError("Atlas controls use world scope")
      keys = ["facilityQuery", "facilityAfter"]
      result = { ...base, purpose: "counts" }
      if (r.facilityQuery !== undefined)
        result.facilityQuery = boundedString(
          r.facilityQuery,
          ATLAS_LIMITS.searchLength
        )
      if (r.facilityAfter !== undefined)
        result.facilityAfter = boundedString(
          r.facilityAfter,
          ATLAS_LIMITS.optionNameLength
        )
      break
    case "suggestions":
      if (scope.bbox) throw new RangeError("Atlas controls use world scope")
      result = { ...base, purpose: r.purpose }
      break

    default:
      throw new RangeError("Unsupported Atlas purpose")
  }
  if (
    Object.keys(r).some(
      (key) => !["schemaVersion", "scope", "purpose", ...keys].includes(key)
    )
  )
    throw new RangeError("Unexpected Atlas purpose input")

  return result
}
