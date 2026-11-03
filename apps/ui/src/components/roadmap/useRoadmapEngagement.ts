"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { authClient } from "@/lib/auth-client"
import type { RoadmapEngagement, RoadmapEngagementData } from "@/lib/roadmap"

const EMPTY: RoadmapEngagementData = {
  engagement: {},
  voted: [],
  suggestions: [],
}
const NO_ENGAGEMENT: RoadmapEngagement = {
  votes: 0,
  posts: 0,
  activityAt: null,
  threadId: null,
}

/**
 * Counts and the viewer's own votes, read after hydration so cached pages
 * never carry one account's votes. A response for an earlier account is
 * dropped. Votes are not optimistic: the button waits for the new total.
 */
export function useRoadmapEngagement(locale: string) {
  const { data: session, isPending } = authClient.useSession()
  const viewer = isPending ? null : (session?.user?.id ?? "anonymous")
  const current = useRef(viewer)
  current.current = viewer
  const [data, setData] = useState<RoadmapEngagementData>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const scope = current.current
      const response = await fetch(
        `/api/roadmap/engagement?locale=${encodeURIComponent(locale)}`,
        { cache: "no-store", signal }
      )
      if (!response.ok) throw new Error(String(response.status))
      const json = (await response.json()) as { data?: RoadmapEngagementData }
      if (scope !== current.current || signal?.aborted) return
      setData({ ...EMPTY, ...json.data })
      setLoaded(true)
    },
    [locale]
  )

  useEffect(() => {
    if (viewer === null) return
    const controller = new AbortController()
    refresh(controller.signal).catch(() => {
      if (!controller.signal.aborted) setLoaded(true)
    })

    return () => controller.abort()
  }, [viewer, refresh])

  const vote = useCallback(async (key: string, voted: boolean) => {
    let saved = false
    const scope = current.current
    setBusyKey(key)
    setError(null)
    try {
      const response = await fetch("/api/roadmap/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, voted }),
      })
      const json = (await response.json().catch(() => ({}))) as {
        data?: { voted: boolean; votes: number }
      }
      if (!response.ok || !json.data) throw new Error(String(response.status))
      if (scope !== current.current) return false
      const result = json.data
      saved = true
      setData((previous) => ({
        ...previous,
        voted: result.voted
          ? [...new Set([...previous.voted, key])]
          : previous.voted.filter((k) => k !== key),
        engagement: {
          ...previous.engagement,
          [key]: {
            ...(previous.engagement[key] ?? NO_ENGAGEMENT),
            votes: result.votes,
          },
        },
      }))
    } catch {
      setError(key)
    } finally {
      setBusyKey(null)
    }

    return saved
  }, [])

  return {
    signedIn: Boolean(session?.user),
    ready: viewer !== null && loaded,
    engagementOf: (key: string) => data.engagement[key] ?? NO_ENGAGEMENT,
    hasVoted: (key: string) => data.voted.includes(key),
    suggestions: data.suggestions,
    busyKey,
    error,
    vote,
    refresh: () => refresh().catch(() => {}),
  }
}
