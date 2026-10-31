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
      // Dashboard pages scroll inside the canvas (or the page on phones).
      // Intersect every clipping ancestor rather than using the window height.
      let top = 0
      let bottom = window.innerHeight
      for (
        let parent = body.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (
          /(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowY)
        ) {
          const bounds = parent.getBoundingClientRect()
          top = Math.max(top, bounds.top)
          bottom = Math.min(bottom, bounds.bottom)
        }
      }
      const toolbar = body
        .closest(".dashboard-page")
        ?.querySelector(".record-toolbar")
      if (toolbar) top = Math.max(top, toolbar.getBoundingClientRect().bottom)
      const progress = rect.height > 0 ? (bottom - rect.top) / rect.height : 0
      if (
        sample(
          performance.now(),
          document.visibilityState === "visible" &&
            bottom > top &&
            rect.bottom > top &&
            rect.top < bottom &&
            !document.querySelector(
              '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
            ),
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
    document.addEventListener("scroll", check, { capture: true, passive: true })
    window.addEventListener("resize", check)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", check)
      document.removeEventListener("scroll", check, true)
      window.removeEventListener("resize", check)
    }
  }, [bodyId, contentId, contentType, path, consentVersion])

  return null
}
