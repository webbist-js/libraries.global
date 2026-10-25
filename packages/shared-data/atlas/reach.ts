import { parseAtlasPolygon, type AtlasPolygonGeometry } from "./geometry"

export const ATLAS_REACH_MINUTES = [5, 10, 15, 30] as const
export type AtlasReachMode = "walking" | "cycling"
export type AtlasReachMinutes = (typeof ATLAS_REACH_MINUTES)[number]
export interface AtlasReachRequest {
  schemaVersion: 1
  libraryId: string
  mode: AtlasReachMode
  retry?: boolean
}
export interface AtlasReachProvenance {
  release: string
  source: string
  sourceUrl: string
  licence: string
  year?: number
}
export interface AtlasReachResult {
  schemaVersion: 1
  state: "ready" | "partial"
  libraryId: string
  coordinateHash: string
  mode: AtlasReachMode
  calculatedAt: string
  method: string
  snapDistanceMetres: number
  network: AtlasReachProvenance
  population: AtlasReachProvenance
  warnings: string[]
  contours: {
    minutes: AtlasReachMinutes
    residents: number | null
    coveredFraction: number
    geometry: AtlasPolygonGeometry
  }[]
}
export type AtlasReachResponse =
  | AtlasReachResult
  | {
      schemaVersion: 1
      state:
        | "pending"
        | "unsupported"
        | "unroutable"
        | "missing_population"
        | "failed"
      libraryId: string
      mode: AtlasReachMode
      message: string
      retryAfter?: number
    }

export function parseAtlasReachRequest(input: unknown): AtlasReachRequest {
  const r = input as Record<string, unknown>
  if (
    !r ||
    typeof r !== "object" ||
    Array.isArray(r) ||
    r.schemaVersion !== 1 ||
    Object.keys(r).some(
      (k) => !["schemaVersion", "libraryId", "mode", "retry"].includes(k)
    ) ||
    (r.retry !== undefined && typeof r.retry !== "boolean") ||
    typeof r.libraryId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(r.libraryId) ||
    !["walking", "cycling"].includes(String(r.mode))
  )
    throw new RangeError("Invalid Reach request")

  return {
    schemaVersion: 1,
    libraryId: r.libraryId,
    mode: r.mode as AtlasReachMode,
    ...(r.retry ? { retry: true } : {}),
  }
}

export function parseAtlasReachResult(input: unknown): AtlasReachResult {
  const r = input as AtlasReachResult
  parseAtlasReachRequest({
    schemaVersion: r?.schemaVersion,
    libraryId: r?.libraryId,
    mode: r?.mode,
  })
  if (
    !["ready", "partial"].includes(r.state) ||
    !Number.isFinite(Date.parse(r.calculatedAt)) ||
    !/^[a-f0-9]{16,64}$/.test(r.coordinateHash) ||
    typeof r.method !== "string" ||
    r.method.length > 200 ||
    !Number.isFinite(r.snapDistanceMetres) ||
    r.snapDistanceMetres < 0 ||
    r.snapDistanceMetres > 100 ||
    !Array.isArray(r.contours) ||
    r.contours.length !== 4 ||
    !Array.isArray(r.warnings) ||
    r.warnings.length > 20 ||
    r.warnings.some((w) => typeof w !== "string" || w.length > 500)
  )
    throw new RangeError("Invalid Reach result")
  for (const source of [r.network, r.population]) {
    if (
      !source ||
      !/^[a-zA-Z0-9._-]{1,128}$/.test(source.release) ||
      [source.source, source.sourceUrl, source.licence].some(
        (s) => typeof s !== "string" || !s || s.length > 2000
      ) ||
      !/^https?:\/\//.test(source.sourceUrl) ||
      (source.year !== undefined &&
        (!Number.isInteger(source.year) ||
          source.year < 1900 ||
          source.year > 2100))
    )
      throw new RangeError("Invalid Reach provenance")
  }
  let previous = 0
  r.contours.forEach((c, i) => {
    if (
      c.minutes !== ATLAS_REACH_MINUTES[i] ||
      !Number.isFinite(c.coveredFraction) ||
      c.coveredFraction < 0 ||
      c.coveredFraction > 1 ||
      (c.residents !== null &&
        (!Number.isFinite(c.residents) || c.residents < previous)) ||
      (r.state === "ready" && (c.residents === null || c.coveredFraction < 1))
    )
      throw new RangeError("Invalid Reach population bands")
    if (c.residents !== null) previous = c.residents
    parseAtlasPolygon(c.geometry)
  })

  return r
}
