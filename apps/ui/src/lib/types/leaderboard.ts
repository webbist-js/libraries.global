export type LeaderboardEntry = {
  rank: number
  username: string | null
  firstName: string | null
  lastName: string | null
  country: string | null
  city: string | null
  avatarUrl: string | null
  contributorRole: string | null
  periodPoints: number
  totalPoints: number
  tier: string
  approvedCount: number
  acceptanceRate: number | null
}

/** "City, Country", "Country", or null when there's no country to show. */
export function entryPlace(entry: LeaderboardEntry): string | null {
  if (!entry.country) return null

  return entry.city ? `${entry.city}, ${entry.country}` : entry.country
}

export function getDisplayName(entry: LeaderboardEntry): string {
  const full = [entry.firstName, entry.lastName].filter(Boolean).join(" ")

  return full || entry.username || `Contributor #${entry.rank}`
}

export function getInitials(entry: LeaderboardEntry): string {
  const first = entry.firstName?.[0] ?? ""
  const last = entry.lastName?.[0] ?? ""

  return (
    (first + last).toUpperCase() ||
    (entry.username?.slice(0, 2).toUpperCase() ?? "??")
  )
}
