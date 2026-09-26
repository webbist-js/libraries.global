/**
 * homepage controller
 */

import { factories } from "@strapi/strapi"

/** Submissions that count as a contribution (drafts and rejections don't). */
const COUNTED_STATUSES = ["pending", "approved", "needs_info"] as const
const PAGE_SIZE = 500

export default factories.createCoreController(
  "api::homepage.homepage",
  ({ strapi }) => ({
    // ── /homepage/stats ──────────────────────────────────────────────────────
    // Live community proof for the homepage: published libraries, countries
    // with at least one published library, distinct contributors with an
    // accepted submission, and contributions submitted this calendar month.
    async stats(ctx) {
      const libraries = strapi.documents("api::library.library")
      const submissions = strapi.documents(
        "plugin::content-moderation.submission"
      )

      const libraryCount = await libraries.count({ status: "published" })

      const countryIds = new Set<string>()
      for (let start = 0; start < libraryCount; start += PAGE_SIZE) {
        const page = (await libraries.findMany({
          status: "published",
          fields: ["id"],
          populate: { country: { fields: ["documentId"] } },
          start,
          limit: PAGE_SIZE,
        })) as { country?: { documentId?: string } | null }[]
        for (const entry of page) {
          if (entry.country?.documentId)
            countryIds.add(entry.country.documentId)
        }
      }

      const contributors = new Set<string>()
      for (let start = 0; ; start += PAGE_SIZE) {
        const page = (await submissions.findMany({
          filters: { status: { $eq: "approved" } },
          fields: ["submittedByUserId", "submittedByEmail"],
          start,
          limit: PAGE_SIZE,
        })) as {
          submittedByUserId?: string | null
          submittedByEmail?: string | null
        }[]
        for (const entry of page) {
          const key = entry.submittedByUserId || entry.submittedByEmail
          if (key) contributors.add(key.toLowerCase())
        }
        if (page.length < PAGE_SIZE) break
      }

      const now = new Date()
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      )
      const contributionsThisMonth = await submissions.count({
        filters: {
          status: { $in: [...COUNTED_STATUSES] },
          createdAt: { $gte: monthStart.toISOString() },
        },
      })

      ctx.body = {
        data: {
          libraries: libraryCount,
          countries: countryIds.size,
          contributors: contributors.size,
          contributionsThisMonth,
        },
        meta: {},
      }
    },
  })
)
