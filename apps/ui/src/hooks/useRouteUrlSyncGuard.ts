"use client"

import { SUPPORTED_LOCALES } from "@repo/shared-data"
import { useCallback, useEffect, useRef } from "react"

function unlocalized(pathname: string) {
  const parts = pathname.split("/").filter(Boolean)
  if (
    SUPPORTED_LOCALES.includes(parts[0] as (typeof SUPPORTED_LOCALES)[number])
  )
    parts.shift()

  return `/${parts.join("/")}`
}

/** A delayed page-state write must not cancel an accepted Next.js navigation. */
export function useRouteUrlSyncGuard() {
  const owner = useRef({ pathname: "", leaving: false })
  useEffect(() => {
    owner.current = { pathname: window.location.pathname, leaving: false }
    const requested = (event: Event) => {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href
      if (!href) return
      const destination = new URL(href, window.location.href)
      if (
        unlocalized(destination.pathname) !==
        unlocalized(owner.current.pathname)
      )
        owner.current.leaving = true
    }
    const resumed = () => {
      if (window.location.pathname === owner.current.pathname)
        owner.current.leaving = false
    }
    window.addEventListener("dashboard-before-navigation", requested)
    window.addEventListener("popstate", resumed)
    window.addEventListener("pageshow", resumed)

    return () => {
      window.removeEventListener("dashboard-before-navigation", requested)
      window.removeEventListener("popstate", resumed)
      window.removeEventListener("pageshow", resumed)
    }
  }, [])

  return useCallback(
    () =>
      !owner.current.leaving &&
      window.location.pathname === owner.current.pathname,
    []
  )
}
