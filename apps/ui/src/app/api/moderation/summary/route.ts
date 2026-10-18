import { reviewCategoriesInScope } from "@repo/access"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import type {
  CategoryStat,
  ReviewView,
} from "@/components/moderation/workspace"
import { requireCapability, sessionCapabilities } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { fetchModeration } from "@/lib/moderation-proxy"
import { fetchDiscussionReviewCount } from "@/lib/moderation-work-counts"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

const limiter = createRateLimiter({
  name: "moderation-summary",
  max: 60,
  windowMs: 60_000,
})

/** Counts only, with the same scope and self-review rules as the workspace. */
export async function GET() {
  const session = await getSessionSSR(await headers())
  const user = session?.user
  const denied = requireCapability(user, "moderate.queue")
  if (denied || !user) return denied ?? new Response(null, { status: 401 })
  const limit = await limiter.check(user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  const scopes = sessionCapabilities(user).moderation
  const categories = reviewCategoriesInScope(scopes)
  const discussions = scopes.some(
    (s) => s.queue === "all" || s.queue === "discussions"
  )
  const [stats, discussionCount] = await Promise.all([
    categories.length
      ? fetchModeration<{ data?: CategoryStat[] }>(user, "stats?group=category")
      : null,
    discussions ? fetchDiscussionReviewCount(user) : null,
  ])
  const rows =
    stats?.status === 200 && Array.isArray(stats.body?.data)
      ? stats.body.data
      : []
  const data: { id: ReviewView; pending: number | null }[] = categories.map(
    (id) => {
      const count = rows.find(
        (row) => row.category === id && row.status === "pending"
      )?.count

      return {
        id,
        pending: Number.isSafeInteger(count) && count! >= 0 ? count! : null,
      }
    }
  )
  if (discussions) data.push({ id: "discussions", pending: discussionCount })

  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
