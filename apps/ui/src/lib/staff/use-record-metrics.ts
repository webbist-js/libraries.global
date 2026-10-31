"use client"

import { useQuery } from "@tanstack/react-query"

import type { StaffOverview } from "@/lib/staff/types"

export type StaffRecordMetrics = {
  suggestions: number | null
  noticesActive: number | null
  completeness: number | null
}

/** Summary cards share actor/record cache keys and preserve unknown values. */
export function useStaffRecordMetrics(
  userId: string,
  id: string,
  initial?: StaffRecordMetrics | null
) {
  return useQuery({
    queryKey: ["staff-contribute-overview", userId, id],
    enabled: Boolean(id),
    staleTime: 30_000,
    retry: false,
    initialData: initial ?? undefined,
    queryFn: async ({ signal }): Promise<StaffRecordMetrics> => {
      const response = await fetch(
        `/api/staff/${encodeURIComponent(id)}/overview`,
        { cache: "no-store", signal }
      )
      if (!response.ok) throw new Error("staff_overview_unavailable")
      const overview = (await response.json()) as StaffOverview

      return {
        suggestions: overview.counts.suggestions,
        noticesActive: overview.counts.noticesActive ?? null,
        completeness: overview.library.completeness ?? null,
      }
    },
  })
}
