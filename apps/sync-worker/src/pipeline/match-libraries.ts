import {
  isLikelyMatch,
  normalisedDistance,
  type MatchResult,
} from "../lib/levenshtein"
import type { LibraryHint } from "../providers/types"

interface MatchOutput {
  result: MatchResult
  library: LibraryHint | null
}

/**
 * Given a venue name from a provider event, find the best matching library
 * from the credential's library hints.
 */
export function matchVenueToLibrary(
  venueName: string,
  hints: LibraryHint[]
): MatchOutput {
  if (!hints.length) return { result: "none", library: null }

  let bestHint: LibraryHint | null = null
  let bestDist = Infinity

  for (const hint of hints) {
    const d = normalisedDistance(venueName, hint.name)
    if (d < bestDist) {
      bestDist = d
      bestHint = hint
    }
  }

  const result = isLikelyMatch(venueName, bestHint!.name)

  return {
    result,
    library: result !== "none" ? bestHint : null,
  }
}
