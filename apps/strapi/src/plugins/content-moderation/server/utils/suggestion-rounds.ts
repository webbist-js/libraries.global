import { compareSuggestionRank } from "@repo/shared-data"

import { listSuggestions } from "./option-suggestions"

export const ROUND = "plugin::content-moderation.suggestion-round"
const SUGGESTION = "plugin::content-moderation.option-suggestion"

/** All ranking-changing writes and cutoff snapshots share one database lock. */
export async function withBoardLock<T>(
  strapi: any,
  work: () => Promise<T>
): Promise<T> {
  if (!strapi.db?.transaction) return work()

  return strapi.db.transaction(async ({ trx }: any) => {
    if (["pg", "postgres", "postgresql"].includes(strapi.db.dialect?.client))
      await trx.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [
        "suggestion-board",
      ])

    return work()
  })
}

export function firstTuesday(year: number, month: number): Date {
  const value = new Date(Date.UTC(year, month, 1))
  value.setUTCDate(1 + ((2 - value.getUTCDay() + 7) % 7))

  return value
}

export function nextReview(now: Date): Date {
  const value = firstTuesday(now.getUTCFullYear(), now.getUTCMonth())

  return value > now
    ? value
    : firstTuesday(now.getUTCFullYear(), now.getUTCMonth() + 1)
}

export function rankSuggestions<
  T extends { votes: number; createdAt?: string; documentId: string },
>(items: T[]): T[] {
  return [...items].sort(compareSuggestionRank)
}

async function eligible(strapi: any, cutoff?: string) {
  const items = await listSuggestions(strapi, {
    statuses: ["open"],
    publicOnly: true,
  })

  return rankSuggestions(
    items.filter(
      (item) =>
        !cutoff ||
        Date.parse(item.publicationAt ?? item.createdAt ?? "1970-01-01") <=
          Date.parse(cutoff)
    )
  )
}

/** Called under the board lock; lazy recovery and cron use the same operation. */
export async function syncReviewRound(strapi: any, now = new Date()) {
  const docs = strapi.documents(ROUND)
  let [round] = await docs.findMany({
    filters: { state: { $ne: "closed" } },
    sort: ["cutoffAt:asc"],
    limit: 1,
  })
  if (!round) {
    const review = nextReview(now)
    const previous = firstTuesday(
      review.getUTCFullYear(),
      review.getUTCMonth() - 1
    )
    const key = review.toISOString().slice(0, 10)
    const [existing] = await docs.findMany({
      filters: { key: { $eq: key } },
      limit: 1,
    })
    if (existing?.state === "closed") {
      review.setUTCMonth(review.getUTCMonth() + 1)
      const next = firstTuesday(review.getUTCFullYear(), review.getUTCMonth())
      round = await docs.create({
        data: {
          key: next.toISOString().slice(0, 10),
          opensAt: now.toISOString(),
          cutoffAt: next.toISOString(),
          reviewAt: next.toISOString(),
          capacity: 5,
          state: "voting",
          version: 0,
        },
      })
    } else
      round =
        existing ??
        (await docs.create({
          data: {
            key,
            opensAt: previous.toISOString(),
            cutoffAt: review.toISOString(),
            reviewAt: review.toISOString(),
            capacity: 5,
            state: "voting",
            version: 0,
          },
        }))
  }
  if (round.state === "voting" && Date.parse(round.cutoffAt) <= now.getTime()) {
    const selected = (await eligible(strapi, round.cutoffAt)).slice(
      0,
      round.capacity
    )
    round = await docs.update({
      documentId: round.documentId,
      data: {
        state: "review",
        snapshotAt: now.toISOString(),
        version: round.version + 1,
        shortlist: selected.map((item, index) => ({
          documentId: item.documentId,
          name: item.name,
          optionKey: item.optionKey,
          votes: item.votes,
          rank: index + 1,
        })),
      },
    })
  }

  return round
}

export async function reviewRoundView(strapi: any, publicOnly = true) {
  return withBoardLock(strapi, async () => {
    const round = await syncReviewRound(strapi)
    let shortlist =
      round.state === "voting"
        ? (await eligible(strapi))
            .slice(0, round.capacity)
            .map((item, index) => ({
              documentId: item.documentId,
              name: item.name,
              optionKey: item.optionKey,
              votes: item.votes,
              rank: index + 1,
            }))
        : (round.shortlist ?? [])
    if (publicOnly && round.state !== "voting") {
      const visible = await listSuggestions(strapi, {
        statuses: ["open", "reviewing", "planned", "accepted", "declined"],
        publicOnly: true,
      })
      const current = new Map(visible.map((item) => [item.documentId, item]))
      shortlist = shortlist
        .filter((item: any) => current.has(item.documentId))
        .map((item: any) => ({
          ...item,
          name: current.get(item.documentId)!.name,
        }))
    }

    return {
      documentId: round.documentId,
      version: round.version,
      opensAt: round.opensAt,
      cutoffAt: round.cutoffAt,
      reviewAt: round.reviewAt,
      capacity: round.capacity,
      state: round.state,
      shortlist,
      snapshotAt: round.snapshotAt ?? null,
    }
  })
}

export async function updateReviewRound(strapi: any, input: any) {
  return withBoardLock(strapi, async () => {
    const round = await syncReviewRound(strapi)
    if (input.version !== round.version)
      return {
        ok: false,
        status: 409,
        message: "The round changed. Reload before saving.",
      }
    if (input.action === "close") {
      if (round.state !== "review")
        return {
          ok: false,
          status: 400,
          message: "Voting must close before completing the review.",
        }
      const ids = (round.shortlist ?? []).map((item: any) => item.documentId)
      const remaining = ids.length
        ? await strapi.documents(SUGGESTION).count({
            filters: {
              documentId: { $in: ids },
              status: { $in: ["open", "reviewing"] },
            },
          })
        : 0
      if (remaining)
        return {
          ok: false,
          status: 400,
          message:
            "Decide or defer every shortlisted suggestion before completing this round.",
        }
      await strapi.documents(ROUND).update({
        documentId: round.documentId,
        data: {
          state: "closed",
          closedAt: new Date().toISOString(),
          version: round.version + 1,
        },
      })
    } else if (input.action === "schedule") {
      if (round.state !== "voting")
        return {
          ok: false,
          status: 400,
          message: "A saved shortlist cannot be rescheduled.",
        }
      const cutoff = Date.parse(input.cutoffAt)
      const review = Date.parse(input.reviewAt)
      const capacity = input.capacity
      if (
        !Number.isFinite(cutoff) ||
        !Number.isFinite(review) ||
        cutoff <= Date.now() ||
        cutoff > Date.now() + 366 * 86400000 ||
        review < cutoff ||
        review > cutoff + 31 * 86400000 ||
        !Number.isInteger(capacity) ||
        capacity < 1 ||
        capacity > 20
      )
        return {
          ok: false,
          status: 400,
          message:
            "Choose a future cutoff, a review within 31 days, and 1–20 places.",
        }
      await strapi.documents(ROUND).update({
        documentId: round.documentId,
        data: {
          cutoffAt: new Date(cutoff).toISOString(),
          reviewAt: new Date(review).toISOString(),
          capacity,
          version: round.version + 1,
        },
      })
    } else
      return { ok: false, status: 400, message: "Choose schedule or close." }

    return { ok: true }
  })
}
