"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useSyncExternalStore } from "react"

import { CookieConsent } from "@/components/providers/CookieConsent"
import {
  installAnalyticsClickTracking,
  subscribeAnalyticsConsent,
} from "@/lib/analytics-events"
import { installGoogleAnalytics } from "@/lib/google-analytics"

const analyticsInstalled = () =>
  typeof window !== "undefined" && Boolean(window.librariesGlobalAnalytics)
const noServerController = () => false

export function GoogleAnalytics({
  nonce,
  locale = "en",
  checkoutEnabled = false,
}: {
  readonly checkoutEnabled?: boolean
  readonly nonce?: string
  readonly locale?: string
}) {
  const pathname = usePathname()
  // A nonce belongs to the document. Route renders must not pause/reinstall it.
  const documentNonce = useRef(nonce)
  const documentCheckoutEnabled = useRef(checkoutEnabled)
  const installed = useSyncExternalStore(
    subscribeAnalyticsConsent,
    analyticsInstalled,
    noServerController
  )

  useEffect(() => {
    const analytics = installGoogleAnalytics(
      window,
      documentNonce.current,
      documentCheckoutEnabled.current
    )
    const removeClicks = installAnalyticsClickTracking(window)

    return () => {
      removeClicks()
      analytics?.pause()
    }
  }, [])

  useEffect(() => {
    window.librariesGlobalAnalytics?.pageView()
  }, [pathname])

  return installed ? <CookieConsent locale={locale} /> : null
}
