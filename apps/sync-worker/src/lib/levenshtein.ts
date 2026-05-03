/** Levenshtein edit distance (Wagner-Fischer) */
function editDistance(a: string, b: string): number {
  const m = a.length,
    n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!)
    }
  }

  return dp[m]![n]!
}

/**
 * Normalised Levenshtein distance in [0, 1].
 * 0 = identical, 1 = completely different.
 * Comparison is case-insensitive.
 */
export function normalisedDistance(a: string, b: string): number {
  const la = a.toLowerCase().trim()
  const lb = b.toLowerCase().trim()
  if (la === lb) return 0
  const maxLen = Math.max(la.length, lb.length)
  if (maxLen === 0) return 0

  return editDistance(la, lb) / maxLen
}

export type MatchResult = "confident" | "review" | "none"

/**
 * Classifies a venue → library name match by distance thresholds.
 * confident = distance <= 0.25
 * review    = distance 0.25–0.40
 * none      = distance > 0.40
 */
export function isLikelyMatch(
  venueName: string,
  libraryName: string
): MatchResult {
  const d = normalisedDistance(venueName, libraryName)
  if (d <= 0.25) return "confident"
  if (d <= 0.4) return "review"

  return "none"
}
