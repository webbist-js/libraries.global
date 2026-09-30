import type { Core } from "@strapi/strapi"

import { libraryJoin, tableOf } from "./library-sql"

const LIBRARY = "api::library.library"
const SUBMISSION = "plugin::content-moderation.submission"

/** Submissions that count as a contribution (drafts and rejections don't). */
const COUNTED_STATUSES = ["pending", "approved", "needs_info"] as const

const TTL_MS = 5 * 60 * 1000

export type HomepageStats = {
  libraries: number
  countries: number
  contributors: number
  contributionsThisMonth: number
}

let cached: { at: number; value: Promise<HomepageStats> } | null = null

/** Test hook: forget the memoised stats. */
export function resetHomepageStatsCache(): void {
  cached = null
}

const firstNumber = (rows: unknown, key: string): number => {
  const row = Array.isArray(rows) ? rows[0] : rows

  return Number((row as Record<string, unknown> | undefined)?.[key]) || 0
}

async function computeHomepageStats(
  strapi: Core.Strapi
): Promise<HomepageStats> {
  const knex = strapi.db.connection
  const libraries = tableOf(strapi, LIBRARY)
  const country = libraryJoin(strapi, "country")
  const submissions = tableOf(strapi, SUBMISSION)

  const now = new Date()
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  )

  const [libraryCount, countryRows, contributorRows, contributionsThisMonth] =
    await Promise.all([
      strapi.documents(LIBRARY).count({ status: "published" }),
      // Countries with at least one published library: distinct country ids
      // on the link table, joined to the published library rows.
      knex(`${country.linkTable} as cl`)
        .join(`${libraries} as l`, "l.id", `cl.${country.libraryColumn}`)
        .whereNotNull("l.published_at")
        .select(
          knex.raw(`count(distinct cl.${country.targetColumn}) as countries`)
        ),
      // Distinct people with an approved submission, by user id when signed
      // in, else by (lower-cased) email.
      knex(submissions)
        .where("status", "approved")
        .select(
          knex.raw(
            "count(distinct coalesce(submitted_by_user_id, lower(submitted_by_email))) as contributors"
          )
        ),
      strapi.documents(SUBMISSION).count({
        filters: {
          status: { $in: [...COUNTED_STATUSES] },
          createdAt: { $gte: monthStart.toISOString() },
        } as never,
      }),
    ])

  return {
    libraries: libraryCount,
    countries: firstNumber(countryRows, "countries"),
    contributors: firstNumber(contributorRows, "contributors"),
    contributionsThisMonth,
  }
}

/**
 * Live community proof for the homepage: published libraries, countries with
 * at least one published library, distinct contributors with an accepted
 * submission, and contributions submitted this calendar month. Counted in
 * the database and memoised for five minutes (the in-flight promise is
 * shared, and a failed build is dropped so the next request retries).
 */
export function getHomepageStats(strapi: Core.Strapi): Promise<HomepageStats> {
  if (cached && Date.now() - cached.at <= TTL_MS) return cached.value
  const value = computeHomepageStats(strapi)
  const entry = { at: Date.now(), value }
  cached = entry
  value.catch(() => {
    if (cached === entry) cached = null
  })

  return value
}
