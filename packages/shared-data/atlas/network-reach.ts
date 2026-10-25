import type { AtlasBounds, AtlasScope } from "./contracts"
import { parseAtlasScope } from "./filters"
import { parseAtlasPolygon, type AtlasPolygonGeometry } from "./geometry"
import {
  parseAtlasReachResult,
  type AtlasReachMode,
  type AtlasReachResult,
} from "./reach"
import {
  validateAtlasCommunityReach,
  type AtlasCommunityReach,
} from "./reach-insights"

export interface AtlasNetworkReachRequest {
  schemaVersion: 1
  networkId: string
  areaCode?: string
  mode: AtlasReachMode
  scope: AtlasScope
  retry?: boolean
}
export interface AtlasNetworkOption {
  documentId: string
  name: string
  kind: string
}
export interface AtlasNetworkSelection extends AtlasNetworkOption {
  bounds: AtlasBounds | null
  areaCodes: string[]
  areaName: string
  eligibleLibraries: number
  excludedLibraries: number
  available: boolean
  countries: { documentId: string; name: string }[]
}
export interface AtlasNetworkPage {
  networks: AtlasNetworkOption[]
  countries: { documentId: string; name: string }[]
  regions: { documentId: string; name: string }[]
  next: string | null
  selected: AtlasNetworkSelection | null
}
export interface AtlasNetworkReachResult extends AtlasReachResult {
  community?: AtlasCommunityReach
  analysis?: {
    schemaVersion: 2
    eligibleLibraries: {
      libraryId: string
      coordinateHash: string
      lat: number
      lng: number
      country: string
    }[]
    serviceLibraries: number
    filteredOutLibraries: number
    routingRelease: string
    communityRelease: string | null
  }
  areaCodes?: string[]
  scope?: AtlasScope
  reportingArea?: {
    name: string
    version: string
    sourceUrl: string
    licence: string
  }
  kind: "network"
  networkId: string
  networkName: string
  areaCode: string
  selectionHash: string
  totalResidents: number | null
  selectedLibraries: number
  excludedLibraries: number
  unavailableLibraries: number
  contours: (AtlasReachResult["contours"][number] & {
    empty?: boolean
    gapGeometry?: AtlasPolygonGeometry | null
    percent: number | null
    outsideResidents: number | null
  })[]
}
export function parseAtlasNetworkReachRequest(
  input: unknown
): AtlasNetworkReachRequest {
  const r = input as AtlasNetworkReachRequest
  if (
    !r ||
    typeof r !== "object" ||
    Array.isArray(r) ||
    r.schemaVersion !== 1 ||
    Object.keys(r).some(
      (key) =>
        ![
          "schemaVersion",
          "networkId",
          "areaCode",
          "mode",
          "scope",
          "retry",
        ].includes(key)
    ) ||
    typeof r.networkId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(r.networkId) ||
    (r.areaCode !== undefined &&
      (typeof r.areaCode !== "string" || !/^[EWSN]\d{8}$/.test(r.areaCode))) ||
    !["walking", "cycling"].includes(r.mode) ||
    (r.retry !== undefined && typeof r.retry !== "boolean")
  )
    throw new RangeError("Invalid network Reach request")
  const scope = parseAtlasScope(r.scope)
  if (scope.bbox || scope.place)
    throw new RangeError("Choose a reporting area independently of the map")

  return { ...r, scope }
}
export function parseAtlasNetworkReachResult(
  input: unknown
): AtlasNetworkReachResult {
  const r = input as AtlasNetworkReachResult
  parseAtlasReachResult(r)
  if (
    r.areaCodes !== undefined &&
    (!Array.isArray(r.areaCodes) ||
      !r.areaCodes.length ||
      r.areaCodes.length > 361 ||
      new Set(r.areaCodes).size !== r.areaCodes.length ||
      r.areaCodes.some((code) => !/^[EWSN]\d{8}$/.test(code)) ||
      r.areaCodes[0] !== r.areaCode)
  )
    throw new RangeError("Invalid service reporting areas")
  if (
    r.kind !== "network" ||
    typeof r.networkId !== "string" ||
    typeof r.areaCode !== "string" ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(r.networkId) ||
    r.libraryId !== `network-${r.networkId}` ||
    !/^[EWSN]\d{8}$/.test(r.areaCode) ||
    r.selectionHash !== r.coordinateHash ||
    typeof r.networkName !== "string" ||
    r.networkName.length > 240 ||
    ![r.selectedLibraries, r.excludedLibraries, r.unavailableLibraries].every(
      (n) => Number.isSafeInteger(n) && n >= 0
    ) ||
    r.selectedLibraries < 1 ||
    r.selectedLibraries > 250 ||
    r.unavailableLibraries > r.selectedLibraries ||
    (r.totalResidents !== null &&
      (!Number.isFinite(r.totalResidents) || r.totalResidents < 0))
  )
    throw new RangeError("Invalid network Reach result")
  for (const band of r.contours) validateNetworkBand(r, band)

  validateSelectionSnapshot(r)

  validateAtlasCommunityReach(r)

  return r
}

function validateNetworkBand(
  r: AtlasNetworkReachResult,
  band: AtlasNetworkReachResult["contours"][number]
) {
  if (band.gapGeometry) parseAtlasPolygon(band.gapGeometry)
  if (
    band.residents !== null &&
    r.totalResidents !== null &&
    r.unavailableLibraries === 0
  ) {
    const tolerance = Math.max(0.001, r.totalResidents * 1e-9)
    const outside = r.totalResidents - band.residents
    const percent =
      r.totalResidents > 0 ? (band.residents / r.totalResidents) * 100 : null
    if (
      outside < -tolerance ||
      band.outsideResidents === null ||
      Math.abs(band.outsideResidents - Math.max(0, outside)) > tolerance ||
      (percent === null
        ? band.percent !== null
        : band.percent === null || Math.abs(band.percent - percent) > 0.000001)
    )
      throw new RangeError("Inconsistent network population totals")
  }
  if (
    (band.percent !== null &&
      (!Number.isFinite(band.percent) ||
        band.percent < 0 ||
        band.percent > 100)) ||
    (band.outsideResidents !== null &&
      (!Number.isFinite(band.outsideResidents) || band.outsideResidents < 0)) ||
    ((r.unavailableLibraries > 0 ||
      r.totalResidents === null ||
      band.residents === null) &&
      (band.percent !== null ||
        band.outsideResidents !== null ||
        band.gapGeometry != null))
  )
    throw new RangeError("Invalid network coverage")
}

function validateSelectionSnapshot(r: AtlasNetworkReachResult) {
  if (r.analysis) {
    const a = r.analysis
    if (
      a.schemaVersion !== 2 ||
      !Array.isArray(a.eligibleLibraries) ||
      a.eligibleLibraries.length !== r.selectedLibraries ||
      new Set(a.eligibleLibraries.map((member) => member.libraryId)).size !==
        r.selectedLibraries ||
      !Number.isSafeInteger(a.serviceLibraries) ||
      !Number.isSafeInteger(a.filteredOutLibraries) ||
      a.filteredOutLibraries < 0 ||
      a.serviceLibraries !==
        r.selectedLibraries + r.excludedLibraries + a.filteredOutLibraries ||
      a.eligibleLibraries.some(
        (member) =>
          !/^[a-zA-Z0-9_-]{1,100}$/.test(member.libraryId) ||
          !/^[a-f0-9]{64}$/.test(member.coordinateHash) ||
          !Number.isFinite(member.lat) ||
          !Number.isFinite(member.lng) ||
          Math.abs(member.lat) > 90 ||
          Math.abs(member.lng) > 180
      )
    )
      throw new RangeError("Invalid library selection snapshot")
    if (a.communityRelease !== (r.community?.release?.id ?? null))
      throw new RangeError("Community release mismatch")
  }
}
