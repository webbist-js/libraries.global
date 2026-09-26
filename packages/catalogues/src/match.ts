/**
 * Matches a catalogue's branch name to one of our Library names.
 *
 * Catalogue branch lists are terse ("Airyhall", "Central Lending Library",
 * "Kensington Central Library - F9 - Children's Library") while our records use
 * full names, so we compare on significant tokens rather than raw strings.
 */

export type BranchMatchStatus = "confident" | "review" | "none"

export interface BranchMatch<T> {
  candidate: T | null
  score: number
  status: BranchMatchStatus
}

const NOISE = new Set([
  "a",
  "and",
  "branch",
  "centre",
  "center",
  "community",
  "hub",
  "libraries",
  "library",
  "of",
  "public",
  "the",
])

/** Lower-cases, strips accents/punctuation and shelf-location suffixes. */
export function normaliseBranchName(name: string): string {
  return (
    name
      // "Kensington Central Library - F9 - Children's Library" → first part
      .split(/\s+[-–|]\s+/)[0]!
      .normalize("NFKD")
      .replaceAll(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replaceAll("&", " and ")
      .replaceAll(/[^a-z0-9\s]/g, " ")
      .replaceAll(/\s+/g, " ")
      .trim()
  )
}

function tokens(name: string): string[] {
  const all = normaliseBranchName(name).split(" ").filter(Boolean)
  const significant = all.filter((t) => !NOISE.has(t))

  return significant.length > 0 ? significant : all
}

function editSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const m = a.length
  const n = b.length
  if (m === 0 || n === 0) return 0
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]!
          : 1 + Math.min(prev[j]!, cur[j - 1]!, prev[j - 1]!)
    }
    prev = cur
  }

  return 1 - prev[n]! / Math.max(m, n)
}

/** Similarity in [0, 1] between a branch name and a library name. */
export function branchSimilarity(branch: string, library: string): number {
  const a = tokens(branch)
  const b = tokens(library)
  const setB = new Set(b)
  const shared = a.filter((t) => setB.has(t)).length
  // Containment: every significant token of the shorter name appears in the longer.
  const containment = shared / Math.min(a.length, b.length)
  const jaccard = shared / new Set([...a, ...b]).size
  const edit = editSimilarity(a.join(" "), b.join(" "))

  // No word in common: only near-identical spellings ("Airyhal" / "Airyhall")
  // count. Otherwise "Govanhill" would sit in review next to "Greenhill".
  if (shared === 0) return edit >= 0.8 ? edit : Math.min(edit, 0.5)

  // Containment over-matches short names ("Cove" ⊂ "Cove Bay"), so a single
  // shared token can only ever reach review.
  const damp = Math.min(a.length, b.length) >= 2 ? 0.9 : 0.75

  return Math.max(edit, jaccard, containment * damp)
}

export function matchBranch<T>(
  branch: string,
  candidates: T[],
  nameOf: (c: T) => string
): BranchMatch<T> {
  let best: T | null = null
  let bestScore = 0
  let runnerUp = 0
  for (const c of candidates) {
    const score = branchSimilarity(branch, nameOf(c))
    if (score > bestScore) {
      runnerUp = bestScore
      bestScore = score
      best = c
    } else if (score > runnerUp) {
      runnerUp = score
    }
  }

  // Ambiguous when two candidates are nearly tied: send to review.
  const ambiguous = bestScore - runnerUp < 0.1
  const status: BranchMatchStatus =
    bestScore >= 0.85 && !ambiguous
      ? "confident"
      : bestScore >= 0.6
        ? "review"
        : "none"

  return {
    candidate: status === "none" ? null : best,
    score: Math.round(bestScore * 100) / 100,
    status,
  }
}
