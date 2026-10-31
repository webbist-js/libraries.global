"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Thin top progress bar that shows during page-to-page navigation.
 * - Detects navigation start by listening for same-origin <a> tag clicks.
 * - Detects navigation end when the pathname or query string commits.
 * - Animates from 0 → 65% (fake progress) then snaps to 100% and fades out.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const route = `${pathname}?${search}`
  const [width, setWidth] = useState(0)
  const [opacity, setOpacity] = useState(0)
  const [active, setActive] = useState(false)
  const prevRoute = useRef(route)
  const activeRef = useRef(false)
  const rafRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(
    undefined as unknown as ReturnType<typeof setTimeout>
  )

  const clear = useCallback(() => {
    clearTimeout(timerRef.current)
    cancelAnimationFrame(rafRef.current ?? 0)
  }, [])

  const start = useCallback(() => {
    if (activeRef.current) return
    activeRef.current = true
    setActive(true)
    clear()
    setWidth(0)
    setOpacity(1)
    const slow = () => setWidth(65)
    const middle = () => {
      setWidth(50)
      timerRef.current = setTimeout(slow, 500)
    }
    const first = () => {
      setWidth(20)
      timerRef.current = setTimeout(middle, 200)
    }
    rafRef.current = requestAnimationFrame(first)
  }, [clear])

  const finish = useCallback(() => {
    clear()
    setWidth(100)
    timerRef.current = setTimeout(() => {
      setOpacity(0)
      timerRef.current = setTimeout(() => {
        setWidth(0)
        activeRef.current = false
        setActive(false)
      }, 300)
    }, 180)
  }, [clear])

  // Queue/filter links can navigate without changing the pathname.
  useEffect(() => {
    if (prevRoute.current !== route) {
      prevRoute.current = route
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (activeRef.current) finish()
    }
  }, [route, finish])

  // Detect navigation start via anchor clicks
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>(
        "a[href]"
      )
      if (!anchor) return
      // Skip non-navigation anchors
      if (anchor.target === "_blank") return
      if (anchor.hasAttribute("download")) return
      try {
        const url = new URL(anchor.href, window.location.href)
        if (url.origin !== window.location.origin) return
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        )
          return
        start()
      } catch {
        // Relative hrefs, mailto:, etc — ignore
      }
    }
    document.addEventListener("click", onClick, true)

    return () => {
      document.removeEventListener("click", onClick, true)
      clear()
    }
  }, [start, clear])

  // Don't render when completely hidden
  if (!active && opacity === 0) return null

  return (
    <div
      aria-hidden
      data-navigation-progress=""
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[2px]"
      style={{ opacity }}
    >
      <div
        className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300"
        style={{
          width: `${width}%`,
          transition:
            width >= 100
              ? "width 0.18s ease-out"
              : width <= 20
                ? "width 0.12s ease-out"
                : "width 0.6s ease-out",
          boxShadow: "0 0 6px 1px rgba(34,211,238,0.55)",
        }}
      />
    </div>
  )
}
