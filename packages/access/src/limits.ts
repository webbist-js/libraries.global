export const TIER_NAMES = [
  "Reader",
  "Indexer",
  "Cartographer",
  "Archivist",
  "Scholar",
  "Curator",
] as const
export type TierName = (typeof TIER_NAMES)[number]

type Limits = {
  pendingSubmissions: number
  submissionsPerHour: number
  uploadsPerDay: number
}

const LIMITS: Record<TierName, Limits> = {
  Reader: { pendingSubmissions: 5, submissionsPerHour: 10, uploadsPerDay: 20 },
  Indexer: {
    pendingSubmissions: 10,
    submissionsPerHour: 20,
    uploadsPerDay: 40,
  },
  Cartographer: {
    pendingSubmissions: 20,
    submissionsPerHour: 30,
    uploadsPerDay: 60,
  },
  Archivist: {
    pendingSubmissions: 40,
    submissionsPerHour: 40,
    uploadsPerDay: 100,
  },
  Scholar: {
    pendingSubmissions: 60,
    submissionsPerHour: 50,
    uploadsPerDay: 150,
  },
  Curator: {
    pendingSubmissions: 100,
    submissionsPerHour: 60,
    uploadsPerDay: 200,
  },
}

/** Tier-scaled contribution quotas. Tiers raise limits; they never skip review. */
export function contributionLimits(tier: string | null): Limits {
  return (TIER_NAMES as readonly string[]).includes(tier ?? "")
    ? LIMITS[tier as TierName]
    : LIMITS.Reader
}
