import type { BranchHoldings } from "../types"

/**
 * Dropdown options that are filters or prompts rather than service points.
 * From LibrariesHacked's common.js, compared case-insensitively.
 */
const NOT_BRANCHES = new Set([
  "ALL",
  "ANY",
  "ADULT BOOKS",
  "ALL BRANCHES",
  "ALL HULL CITY LIBRARIES",
  "ALL LOCATIONS",
  "ALL LIBRARIES",
  "ANY LIBRARY",
  "AUDIO BOOKS",
  "CHILDREN'S BOOKS",
  "CHOOSE ONE",
  "DVDS",
  "FICTION",
  "HERE",
  "INVALID KEY",
  "LARGE PRINT",
  "LOCAL HISTORY",
  "NON-FICTION",
  "SCHOOL LIBRARIES COLLECTIONS",
  "SELECT AN ALTERNATIVE",
  "SELECT BRANCH",
  "SELECT DEFAULT BRANCH",
  "SELECT LIBRARY",
  "VIEW ENTIRE COLLECTION",
  "YOUNG ADULT COLLECTION",
])

export function isBranchName(name: string): boolean {
  const n = name.trim()

  return n.length > 0 && !NOT_BRANCHES.has(n.toUpperCase())
}

/** Removes duplicates and non-branch entries while keeping order. */
export function uniqueBranches<T extends { name: string }>(branches: T[]): T[] {
  const seen = new Set<string>()

  return branches.filter((b) => {
    const key = b.name.trim().toLowerCase()
    if (!isBranchName(b.name) || seen.has(key)) return false
    seen.add(key)

    return true
  })
}

/** Accumulates per-copy statuses into per-branch counts. */
export class HoldingsTally {
  private readonly counts = new Map<string, BranchHoldings>()

  add(branch: string, isAvailable: boolean, copies = 1): void {
    const name = branch.trim()
    if (!name) return
    const row = this.counts.get(name) ?? {
      branch: name,
      available: 0,
      unavailable: 0,
    }
    if (isAvailable) row.available += copies
    else row.unavailable += copies
    this.counts.set(name, row)
  }

  toArray(): BranchHoldings[] {
    return [...this.counts.values()]
  }
}

/** Joins a base URL (with trailing slash) and a relative path. */
export function joinUrl(baseUrl: string, path: string): string {
  return new URL(path.replace(/^\//, ""), baseUrl).toString()
}
