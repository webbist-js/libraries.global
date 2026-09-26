export type LeaderboardEntry = {
  rank: number
  username: string | null
  firstName: string | null
  lastName: string | null
  country: string | null
  avatarUrl: string | null
  contributorRole: string | null
  periodPoints: number
  totalPoints: number
  tier: string
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
