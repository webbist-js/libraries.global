"use client"

import { useLayoutEffect, useRef } from "react"

type Position = {
  page: number
  content: number
  navigation: number
  context: number
}
// Browser-only writes from effects/events; no request or account data is stored.
const positions = new Map<string, Position>()
let historyDestination: string | null = null
const locationKey = () =>
  window.location.pathname + window.location.search + window.location.hash

/** The shell survives cached page replacement; individual page effects do not. */
export function useDashboardHistory() {
  useLayoutEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.dataset.dashboardActive = "true"
    body.dataset.dashboardActive = "true"
    body.dataset.dashboardAware = "true"
    const traversed = () => {
      historyDestination = locationKey()
      window.dispatchEvent(new Event("dashboard-history-traversed"))
    }
    window.addEventListener("popstate", traversed, true)

    return () => {
      window.removeEventListener("popstate", traversed, true)
      delete html.dataset.dashboardActive
      delete body.dataset.dashboardActive
    }
  }, [])
}

/** Native history must restore the new scroll containers, not document.body. */
export function useDashboardScroll(path: string) {
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const page = root.current
    if (!page) return
    const content = page.querySelector<HTMLElement>(
      "[data-dashboard-scroll=content]"
    )
    const navigation = page.querySelector<HTMLElement>(
      '[data-dashboard-scroll="navigation"]'
    )
    const context = page.querySelector<HTMLElement>(".dashboard-page-context")
    const ownerPath = window.location.pathname
    const url = locationKey()
    const restore = historyDestination === url ? positions.get(url) : undefined
    if (historyDestination !== url) historyDestination = null
    const apply = (position = restore) => {
      page.scrollTop = position?.page ?? 0
      if (content) content.scrollTop = position?.content ?? 0
      if (navigation) navigation.scrollTop = position?.navigation ?? 0
      if (context) context.scrollTop = position?.context ?? 0
    }
    apply()
    // LayoutRouter also restores focus/scroll during this commit. Apply a
    // history position once more after its layout work, including cached pages.
    const frame = restore ? requestAnimationFrame(() => apply()) : null
    if (!restore) {
      const fragment = window.location.hash.slice(1)
      const heading =
        (fragment ? document.getElementById(fragment) : null) ??
        content?.querySelector<HTMLElement>("h1")
      if (fragment) heading?.scrollIntoView({ block: "start" })
      // A streamed heading may not have hydrated yet. Only focus elements
      // whose React markup already makes them focusable; never mutate its
      // attributes ahead of hydration. The persistent main is the fallback.
      const target = heading?.hasAttribute("tabindex")
        ? heading
        : document.getElementById("main")
      target?.focus({ preventScroll: true })
    }
    const remember = () => {
      // A departing/cached page can emit a final scroll event after pushState.
      // It must not overwrite the position saved immediately before navigation.
      if (window.location.pathname !== ownerPath) return
      positions.set(locationKey(), {
        page: page.scrollTop,
        content: content?.scrollTop ?? 0,
        navigation: navigation?.scrollTop ?? 0,
        context: context?.scrollTop ?? 0,
      })
      if (positions.size > 100) positions.delete(positions.keys().next().value!)
    }
    const traversed = () => {
      if (window.location.pathname !== ownerPath || !historyDestination) return
      const position = positions.get(historyDestination)
      if (position) apply(position)
    }
    page.addEventListener("scroll", remember, { capture: true, passive: true })
    window.addEventListener("dashboard-history-traversed", traversed)
    const navigate = () => {
      remember()
      historyDestination = null
    }
    window.addEventListener("dashboard-before-navigation", navigate)

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      page.removeEventListener("scroll", remember, true)
      window.removeEventListener("dashboard-history-traversed", traversed)
      window.removeEventListener("dashboard-before-navigation", navigate)
    }
  }, [path])

  return root
}
