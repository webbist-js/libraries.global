"use client"

import { useEffect, useSyncExternalStore } from "react"

import {
  analyticsConsentVersion,
  pushAnalyticsEvent,
  subscribeAnalyticsConsent,
} from "@/lib/analytics-events"
import { createReadingTracker } from "@/lib/analytics-reading"
import { analyticsPathKey } from "@/lib/google-analytics"

export function ArticleEngagement({
  bodyId,
  contentId,
  contentType,
  path,
}: {
  readonly bodyId: string
  readonly contentId: string
  readonly contentType: "journal" | "knowledge"
  readonly path: string
}) {
  const consentVersion = useSyncExternalStore(
    subscribeAnalyticsConsent,
    analyticsConsentVersion,
    () => 0
  )
  useEffect(() => {
    if (!consentVersion) return
    const body = document.getElementById(bodyId)
    if (
      !body ||
      analyticsPathKey(window.location.pathname) !== analyticsPathKey(path)
    )
      return
    const sample = createReadingTracker(performance.now())
    const check = () => {
      if (analyticsPathKey(window.location.pathname) !== analyticsPathKey(path))
        return
      const rect = body.getBoundingClientRect()
      const progress =
        rect.height > 0 ? (window.innerHeight - rect.top) / rect.height : 0
      if (
        sample(
          performance.now(),
          document.visibilityState === "visible",
          progress
        )
      ) {
        pushAnalyticsEvent("content_engaged", {
          interaction_source: "article",
          content_type: contentType,
          content_id: contentId,
        })
      }
    }
    check()
    const timer = window.setInterval(check, 1000)
    document.addEventListener("visibilitychange", check)
    window.addEventListener("scroll", check, { passive: true })

    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", check)
      window.removeEventListener("scroll", check)
    }
  }, [bodyId, contentId, contentType, path, consentVersion])

  return null
}
