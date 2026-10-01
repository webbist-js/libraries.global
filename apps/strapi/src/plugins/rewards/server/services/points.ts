import { EARNED_PRO_HOLD_DAYS, isEarnedProTier } from "@repo/access"

import { nextContributorNumber } from "../utils/contributor-number"

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
  | "journal_accepted"
  | "journal_edit_accepted"
  | "journal_translated"
  | "knowledge_article_published"
  | "knowledge_edit_accepted"
  | "source_added"
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

// Thrown inside the award transaction when the idempotency key already
// exists: it rolls the transaction back and is turned into `awarded: false`.
class DuplicateAward extends Error {
  constructor() {
    super("duplicate award")
    this.name = "DuplicateAward"
  }
}

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

    // Every write happens in one transaction: if anything after the event
    // insert fails, the event (and so the idempotency key) is rolled back
    // and the caller can retry. `strapi.db.query()` joins the ambient
    // transaction on its own (AsyncLocalStorage in @strapi/database); the
    // raw knex statement needs `.transacting(trx)` explicitly.
    let newStreak = 0
    try {
      newStreak = await strapi.db.transaction(
        async ({ trx }: { trx: unknown }) =>
          (this as any).awardInTransaction(
            trx,
            baUserId,
            action,
            pts,
            metadata,
            idempotencyKey,
            now
          )
      )
    } catch (err) {
      if (err instanceof DuplicateAward) return { awarded: false }
      throw err
    }

    // Badges read committed rows through the pool, so they run after the
    // commit. Awarding is idempotent, so a failure here never burns the key —
    // and the points are already committed, so it must not fail the award
    // either; the next award re-checks.
    try {
      await strapi
        .plugin("rewards")
        .service("badges")
        .checkAndAward(baUserId, { streak: newStreak })
    } catch (err) {
      strapi.log.warn(`[rewards] badge check failed for ${baUserId}:`, err)
    }

    // A consecutive day of activity earns the daily_streak point, once per
    // day (the key), and never for the streak point itself.
    if (action !== "daily_streak" && newStreak >= 2) {
      const today = now.toISOString().slice(0, 10)
      try {
        await (this as any).award(
          baUserId,
          "daily_streak",
          1,
          { streak: newStreak },
          `streak:${baUserId}:${today}`
        )
      } catch (err) {
        strapi.log.warn(
          `[rewards] daily_streak award failed for ${baUserId}:`,
          err
        )
      }
    }

    return { awarded: true }
  },

  // The body of award(): runs inside strapi.db.transaction and returns the
  // profile's new streak. Throws DuplicateAward when the key lost a race.
  async awardInTransaction(
    trx: unknown,
    baUserId: string,
    action: PointAction,
    pts: number,
    metadata: Record<string, unknown> | undefined,
    idempotencyKey: string | undefined,
    now: Date
  ): Promise<number> {
    try {
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
      if (idempotencyKey && isUniqueViolation(err)) throw new DuplicateAward()
      strapi.log.error(
        `[rewards] Failed to record point event ${action} for ${baUserId}:`,
        err
      )
      throw err
    }

    // Read current profile totals — create a minimal one if it doesn't exist
    // yet. A failure here rolls the event back too, so the key stays free.
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId }, select: ["id"] })

    if (!profile) {
      strapi.log.warn(
        `[rewards] No user-profile found for baUserId ${baUserId} — creating minimal record`
      )
      const n = await nextContributorNumber(strapi, trx)
      await strapi.db.query("api::user-profile.user-profile").create({
        data: {
          baUserId,
          username: `contributor${n}`,
          contributorNumber: n,
        },
      })
    }

    const today = now.toISOString().slice(0, 10)
    const currentMonth = today.slice(0, 7) // "YYYY-MM"

    // Atomic increments on the DB row: concurrent awards can't lose updates
    // the way a read-modify-write on `profile.points` would. COALESCE, not
    // knex's increment(): `NULL + n` is NULL, so a profile whose counters
    // were never set would stay at NULL forever (M1). The month reset is
    // decided in the same statement from the row's own last_activity_date
    // (a "YYYY-MM-DD" string column), so two awards straddling a month
    // boundary can't both see the old month and double-reset.
    const knex = strapi.db.connection
    await knex("user_profiles")
      .transacting(trx)
      .where({ ba_user_id: baUserId })
      .update({
        points: knex.raw("COALESCE(points, 0) + ?", [pts]),
        points_this_month: knex.raw(
          "CASE WHEN substr(last_activity_date, 1, 7) = ? THEN COALESCE(points_this_month, 0) + ? ELSE ? END",
          [currentMonth, pts, pts]
        ),
      })

    const fresh = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
    const newStreak = await (this as any).updateStreak(baUserId)
    const tier = computeTier(fresh?.points ?? 0)
    const wasEarned = isEarnedProTier(fresh?.tier)
    const isEarned = isEarnedProTier(tier.name)
    // D-P4: dropping below Archivist keeps earned Pro for 90 days. The hold
    // is set once, on the downward crossing, and cleared once, on the
    // upward crossing — no write at all on either side of a non-crossing
    // award, since earnedProUntil is already correct there.
    const earnedProUntil =
      isEarned && !wasEarned
        ? null
        : !isEarned && wasEarned
          ? new Date(
              Date.now() + EARNED_PRO_HOLD_DAYS * 86_400_000
            ).toISOString()
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

    return newStreak
  },
})
