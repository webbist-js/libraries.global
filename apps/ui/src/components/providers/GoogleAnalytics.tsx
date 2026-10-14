"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { installAnalyticsClickTracking } from "@/lib/analytics-events"
import { installGoogleAnalytics } from "@/lib/google-analytics"

export function GoogleAnalytics({ nonce }: { readonly nonce?: string }) {
  const pathname = usePathname()

  useEffect(() => {
    const analytics = installGoogleAnalytics(window, nonce)
    const removeClicks = installAnalyticsClickTracking(window)

    return () => {
      removeClicks()
      analytics?.pause()
    }
  }, [nonce])

  useEffect(() => {
    window.librariesGlobalAnalytics?.pageView()
  }, [pathname])

  return null
}
