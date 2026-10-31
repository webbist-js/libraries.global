"use client"

import { useEffect, useRef } from "react"

import { pushAnalyticsEvent, resultBucket } from "@/lib/analytics-events"

/** Server-filtered directories have no client request hook to report their outcome. */
export function SearchResultsAnalytics({
  source,
  searchType,
  searchKey,
  count,
}: {
  readonly source: "network_directory" | "network_members"
  readonly searchType: "networks" | "libraries"
  /** Local deduplication only; never included in the analytics payload. */
  readonly searchKey: string
  readonly count: number
}) {
  const last = useRef<string | null>(null)
  useEffect(() => {
    if (!searchKey || last.current === searchKey) return
    last.current = searchKey
    pushAnalyticsEvent("search_results", {
      interaction_source: source,
      search_type: searchType,
      result_bucket: resultBucket(count),
    })
  }, [source, searchType, searchKey, count])

  return null
}
