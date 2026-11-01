import type {
  AtlasContextPoint,
  AtlasContextRelease,
} from "@/lib/atlas-context"

export type AtlasGapReason =
  | "notInstalled"
  | "chooseEdition"
  | "outsideCoverage"
  | "missingArea"
  | "missingValue"
  | "missingPopulation"
  | "administrativeUnavailable"
  | "partialSource"
  | "unroutable"
  | "unsupportedReach"
  | "partialReach"
  | "communityUnavailable"
  | "communityIncomplete"
  | "communityInsufficient"
  | "unconfirmedAccess"
  | "unverifiedDirectory"
  | "temporaryFailure"
export interface AtlasDataGap {
  id: string
  reasons: AtlasGapReason[]
  details?: string[]
  count?: number
  available?: string[]
}

export function contextDataGap({
  release,
  releases,
  point,
  loading,
  error,
  grid = false,
  location,
}: {
  release: AtlasContextRelease | null
  releases: AtlasContextRelease[]
  point?: AtlasContextPoint
  loading: boolean
  error: boolean
  grid?: boolean
  location?: { lat: number; lng: number } | null
}): AtlasDataGap | null {
  if (loading) return null
  if (error) return { id: "context-error", reasons: ["temporaryFailure"] }
  if (!release)
    return {
      id: "context-not-installed",
      reasons: [
        releases.some((r) => containsLocation(r, location))
          ? "chooseEdition"
          : releases.length
            ? "outsideCoverage"
            : "notInstalled",
      ],
      available: [...new Set(releases.map((r) => r.name))],
    }
  const reasons = pointGapReasons(release, location, point, grid)
  const details = Array.isArray(release.coverage?.gaps)
    ? release.coverage.gaps
        .filter((s): s is string => typeof s === "string")
        .slice(0, 8)
    : undefined
  if (release.coverage?.status === "partial") reasons.push("partialSource")

  return reasons.length
    ? { id: `${release.id}:${reasons.join(":")}`, reasons, details }
    : null
}

export function reachDataGap(
  response: {
    state: string
    warnings?: string[]
    unavailableLibraries?: number
    excludedLibraries?: number
    community?: { state: string }
  },
  network = false
): AtlasDataGap | null {
  if (response.state === "pending") return null
  const failures: Record<string, AtlasGapReason> = {
    failed: "temporaryFailure",
    unsupported: "unsupportedReach",
    unroutable: "unroutable",
    missing_population: "missingPopulation",
  }
  if (failures[response.state])
    return {
      id: `reach-${response.state}`,
      reasons: [failures[response.state]!],
    }
  const reasons: AtlasGapReason[] = []
  const excluded =
    (response.unavailableLibraries ?? 0) + (response.excludedLibraries ?? 0)
  if (response.state === "partial" || excluded > 0) reasons.push("partialReach")
  if (network && response.community?.state !== "ready")
    reasons.push(
      response.community?.state === "incomplete"
        ? "communityIncomplete"
        : response.community?.state === "insufficient"
          ? "communityInsufficient"
          : "communityUnavailable"
    )

  return reasons.length
    ? {
        id: `reach:${reasons.join(":")}`,
        reasons,
        count: excluded || undefined,
        details: response.warnings?.slice(0, 8),
      }
    : null
}

function containsLocation(
  release: AtlasContextRelease,
  location: { lat: number; lng: number } | null | undefined
) {
  return Boolean(
    location &&
    location.lng >= release.bounds.west &&
    location.lng <= release.bounds.east &&
    location.lat >= release.bounds.south &&
    location.lat <= release.bounds.north
  )
}

/** Bounds overlap at borders: require an explicit edition instead of guessing. */
export function contextReleaseAtLocation(
  releases: AtlasContextRelease[],
  selectedId: string,
  location: { lat: number; lng: number } | null | undefined
) {
  const selected = releases.find((r) => r.id === selectedId)
  if (selected) return selected
  const matches = releases.filter((r) => containsLocation(r, location))

  return matches.length === 1 ? matches[0]! : null
}

function pointGapReasons(
  release: AtlasContextRelease,
  location: { lat: number; lng: number } | null | undefined,
  point: AtlasContextPoint | undefined,
  grid: boolean
): AtlasGapReason[] {
  const reasons: AtlasGapReason[] = []
  if (location && !containsLocation(release, location))
    reasons.push("outsideCoverage")
  else if (
    point !== undefined &&
    (grid ? point.density === null : point.area === null)
  )
    reasons.push(grid ? "missingPopulation" : "missingArea")
  else if (!grid && point?.area && point.area.value === null)
    reasons.push("missingValue")

  return reasons
}
