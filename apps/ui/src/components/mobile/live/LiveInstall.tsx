"use client"
import { useEffect } from "react"

import { isLivePagePath } from "@/lib/live-path"

import { registerLiveIcons } from "./icons"

// The live layout renders this on every console page, so the icons are in
// memory before anything under it mounts.
registerLiveIcons()

export function LiveInstall({
  locale,
  mobileApp = false,
}: {
  readonly locale: string
  readonly mobileApp?: boolean
}) {
  useEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined
    if (
      navigation &&
      !mobileApp &&
      !isLivePagePath(new URL(navigation.name).pathname)
    ) {
      window.location.replace(window.location.href)

      return
    }
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register(`/live-sw.js?locale=${locale}`, {
          scope: mobileApp ? "/" : `/${locale}/live`,
        })
        .catch(() => {})
  }, [locale, mobileApp])

  return null
}
