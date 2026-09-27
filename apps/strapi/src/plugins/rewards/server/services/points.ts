import { EARNED_PRO_HOLD_DAYS, isEarnedProTier } from "@repo/access"

export type PointAction =
  | "new_library_approved"
  | "edit_accepted_minor"
  | "edit_accepted_major"
  | "correction_approved"
  | "claim_approved"
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

function isUniqueViolation(err: unknown): boolean {
  const e = err as {
    code?: string
    nativeError?: { code?: string }
    message?: string
  }

  return (
    e?.code === "23505" ||
    e?.nativeError?.code === "23505" ||
    /unique/i.test(String(e?.message ?? ""))
  )
}

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
    metadata?: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<{ awarded: boolean }> {
    const now = new Date()

    // Idempotency check: a previously-seen key means this award already happened.
    if (idempotencyKey) {
      const seen = await strapi.db
        .query("plugin::rewards.point-event")
        .findOne({ where: { idempotencyKey } })
      if (seen) return { awarded: false }
    }

    try {
      // Create the point-event record
      await strapi.db.query("plugin::rewards.point-event").create({
        data: {
          baUserId,
          action,
          points: pts,
          metadata: metadata ?? null,
          awardedAt: now,
          idempotencyKey: idempotencyKey ?? null,
        },
      })
    } catch (err) {
      // Unique violation on idempotencyKey: a concurrent award won the race.
      if (idempotencyKey && isUniqueViolation(err)) return { awarded: false }
      strapi.log.error(
        `[rewards] Failed to record point event ${action} for ${baUserId}:`,
        err
      )
      throw err
    }

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

        return { awarded: true }
      }
    }

    const today = now.toISOString().slice(0, 10)
    const currentMonth = today.slice(0, 7) // "YYYY-MM"
    const lastMonth = profile.lastActivityDate?.slice(0, 7) ?? null
    const sameMonth = lastMonth === currentMonth

    // Atomic increments on the DB row: concurrent awards can't lose updates
    // the way a read-modify-write on `profile.points` would. COALESCE, not
    // knex's increment(): `NULL + n` is NULL, so a profile whose counters
    // were never set would stay at NULL forever (M1).
    const knex = strapi.db.connection
    await knex("user_profiles")
      .where({ ba_user_id: baUserId })
      .update({
        points: knex.raw("COALESCE(points, 0) + ?", [pts]),
        points_this_month: sameMonth
          ? knex.raw("COALESCE(points_this_month, 0) + ?", [pts])
          : pts,
      })

    const fresh = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
    const newStreak = await (this as any).updateStreak(baUserId)
    const tier = computeTier(fresh?.points ?? 0)
    const wasEarned = isEarnedProTier(fresh?.tier)
    const isEarned = isEarnedProTier(tier.name)
    // D-P4: dropping below Archivist keeps earned Pro for 90 days. The hold is
    // set once, on the downward crossing, and cleared on reaching it again.
    const earnedProUntil = isEarned
      ? null
      : wasEarned
        ? new Date(Date.now() + EARNED_PRO_HOLD_DAYS * 86_400_000).toISOString()
        : undefined

    await strapi.db.query("api::user-profile.user-profile").update({
      where: { baUserId },
      data: {
        tier: tier.name,
        streak: newStreak,
        lastActivityDate: today,
        ...(earnedProUntil !== undefined ? { earnedProUntil } : {}),
      },
    })

    // Check and award badges after every point event
    await strapi.plugin("rewards").service("badges").checkAndAward(baUserId)

    return { awarded: true }
  },
})
