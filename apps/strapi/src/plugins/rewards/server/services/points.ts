export type PointAction =
  | "new_library_approved"
  | "edit_accepted_minor"
  | "edit_accepted_major"
  | "photo_licensed_cc"
  | "hours_verified"
  | "status_verified"
  | "wiki_translated"
  | "daily_streak"
  | "manual_award"
  | "manual_deduct"

export type TierInfo = {
  level: number
  name: string
  nextName: string | null
  nextThreshold: number | null
  progressPercent: number
}

const TIERS: { level: number; name: string; min: number }[] = [
  { level: 1, name: "Reader", min: 0 },
  { level: 2, name: "Indexer", min: 100 },
  { level: 3, name: "Cartographer", min: 500 },
  { level: 4, name: "Archivist", min: 1500 },
  { level: 5, name: "Scholar", min: 4000 },
  { level: 6, name: "Curator", min: 9000 },
]

export function computeTier(total: number): TierInfo {
  let current = TIERS[0]
  for (const tier of TIERS) {
    if (total >= tier.min) current = tier
  }
  const nextIdx = TIERS.findIndex((t) => t.level === current.level) + 1
  const next = nextIdx < TIERS.length ? TIERS[nextIdx] : null
  const progressPercent = next
    ? Math.min(
        100,
        Math.round(((total - current.min) / (next.min - current.min)) * 100)
      )
    : 100

  return {
    level: current.level,
    name: current.name,
    nextName: next?.name ?? null,
    nextThreshold: next?.min ?? null,
    progressPercent,
  }
}

export default ({ strapi }: { strapi: any }) => ({
  computeTier,

  async updateStreak(baUserId: string): Promise<number> {
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    if (!profile) return 1

    const today = new Date().toISOString().slice(0, 10)
    const last = profile.lastActivityDate ?? null

    if (last === today) return profile.streak ?? 1

    if (last) {
      const yesterday = new Date(Date.now() - 86_400_000)
        .toISOString()
        .slice(0, 10)
      if (last === yesterday) return (profile.streak ?? 0) + 1
    }

    return 1
  },

  async getForPeriod(baUserId: string, periodStart: Date): Promise<number> {
    const rows = (await strapi.db.connection
      .select(strapi.db.connection.raw("COALESCE(SUM(points), 0) as total"))
      .from("rw_point_events")
      .where("ba_user_id", baUserId)
      .where("awarded_at", ">=", periodStart.toISOString())) as {
      total: string | number
    }[]

    return Number(rows[0]?.total ?? 0)
  },

  async award(
    baUserId: string,
    action: PointAction,
    pts: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const now = new Date()

    // Create the point-event record
    await strapi.documents("plugin::rewards.point-event").create({
      data: {
        baUserId,
        action,
        points: pts,
        metadata: metadata ?? null,
        awardedAt: now,
      },
    })

    // Read current profile totals — create a minimal one if it doesn't exist yet
    let profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    if (!profile) {
      strapi.log.warn(
        `[rewards] No user-profile found for baUserId ${baUserId} — creating minimal record`
      )
      try {
        const count = await strapi.db
          .query("api::user-profile.user-profile")
          .count()
        profile = await strapi.db
          .query("api::user-profile.user-profile")
          .create({
            data: {
              baUserId,
              username: `contributor${count + 1}`,
              contributorNumber: count + 1,
            },
          })
      } catch (createErr) {
        strapi.log.error(
          `[rewards] Failed to create fallback profile for baUserId ${baUserId}:`,
          createErr
        )

        return
      }
    }

    const today = now.toISOString().slice(0, 10)
    const currentMonth = today.slice(0, 7) // "YYYY-MM"
    const lastMonth = profile.lastActivityDate?.slice(0, 7) ?? null

    const newTotal = (profile.points ?? 0) + pts
    const newThisMonth =
      lastMonth === currentMonth ? (profile.pointsThisMonth ?? 0) + pts : pts

    const newStreak = await (this as any).updateStreak(baUserId)
    const tier = computeTier(newTotal)

    await strapi.db.query("api::user-profile.user-profile").update({
      where: { baUserId },
      data: {
        points: newTotal,
        pointsThisMonth: newThisMonth,
        tier: tier.name,
        streak: newStreak,
        lastActivityDate: today,
      },
    })

    // Check and award badges after every point event
    await strapi.plugin("rewards").service("badges").checkAndAward(baUserId)
  },
})
