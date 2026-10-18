"use client"

import { isReviewCategory } from "@repo/access"
import { useQuery } from "@tanstack/react-query"

import type { ReviewView } from "@/components/moderation/workspace"
import { useHydratedSession } from "@/lib/access-client"

export type ModerationSummaryRow = { id: ReviewView; pending: number | null }

export function useModerationSummary(enabled: boolean) {
  const { data } = useHydratedSession()
  const user = data?.user

  return useQuery({
    // A different account or scope must never reuse another review summary.
    queryKey: ["moderation-summary", user?.id, user?.moderationScopes],
    enabled: enabled && !!user,
    staleTime: 15_000,
    queryFn: async ({ signal }): Promise<ModerationSummaryRow[] | null> => {
      const response = await fetch("/api/moderation/summary", {
        signal,
        cache: "no-store",
      })
      if (!response.ok) return null
      const body = (await response.json()) as { data?: ModerationSummaryRow[] }
      if (
        !body ||
        !Array.isArray(body.data) ||
        !body.data.every(
          (row) =>
            row &&
            (isReviewCategory(row.id) || row.id === "discussions") &&
            (row.pending === null ||
              (Number.isSafeInteger(row.pending) && row.pending >= 0))
        )
      )
        return null

      return body.data
    },
  })
}
