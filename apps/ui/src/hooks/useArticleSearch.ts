"use client"

import { useEffect, useState } from "react"

import { captureAnalyticsEvent, resultBucket } from "@/lib/analytics-events"

/** Shares latest-request handling while each section keeps its result presentation. */
export function useArticleSearch<Hit>({
  query,
  locale,
  kind,
  search,
}: {
  query: string
  locale: string
  kind: "journal" | "knowledge"
  search: (query: string, locale: string) => Promise<{ hits: Hit[] }>
}) {
  const requestKey = JSON.stringify([kind, query, locale])
  const [resolved, setResolved] = useState<{ key: string; hits: Hit[] } | null>(
    null
  )
  useEffect(() => {
    if (!query.trim()) return
    let cancelled = false
    const measured = captureAnalyticsEvent("search_results", {
      interaction_source: "article",
      search_type: kind,
    })
    const failed = captureAnalyticsEvent("search_error", {
      interaction_source: "article",
      search_type: kind,
    })
    search(query, locale)
      .then((result) => {
        if (cancelled) return
        setResolved({ key: requestKey, hits: result.hits })
        measured({ result_bucket: resultBucket(result.hits.length) })
      })
      .catch(() => {
        if (cancelled) return
        setResolved({ key: requestKey, hits: [] })
        failed()
      })

    return () => {
      cancelled = true
    }
  }, [query, locale, kind, requestKey, search])
  const active = Boolean(query.trim())
  const searched = active && resolved?.key === requestKey

  return {
    active,
    searched,
    loading: active && !searched,
    results: searched ? resolved.hits : [],
  }
}
