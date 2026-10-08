"use client"
import { useEffect } from "react"

import { registerLiveIcons } from "./icons"

// The live layout renders this on every console page, so the icons are in
// memory before anything under it mounts.
registerLiveIcons()

export function LiveInstall({ locale }: { readonly locale: string }) {
  useEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined
    if (
      navigation &&
      !/^\/(?:en\/|cs\/)?live(?:\/|$)/.test(new URL(navigation.name).pathname)
    ) {
      window.location.replace(window.location.href)

      return
    }
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register(`/live-sw.js?locale=${locale}`, { scope: `/${locale}/live` })
        .catch(() => {})
  }, [locale])

  return null
}
