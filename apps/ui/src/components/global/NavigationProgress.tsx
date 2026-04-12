"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

/**
 * Thin top progress bar that shows during page-to-page navigation.
 * - Detects navigation start by listening for same-origin <a> tag clicks.
 * - Detects navigation end by watching usePathname for changes.
 * - Animates from 0 → 65% (fake progress) then snaps to 100% and fades out.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const [width, setWidth] = useState(0)
  const [opacity, setOpacity] = useState(0)
  const [active, setActive] = useState(false)
  const prevPathname = useRef(pathname)
  const activeRef = useRef(false)
  const rafRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(
    undefined as unknown as ReturnType<typeof setTimeout>
  )

  function clear() {
    clearTimeout(timerRef.current)
    cancelAnimationFrame(rafRef.current ?? 0)
  }

  function start() {
    if (activeRef.current) return
    activeRef.current = true
    setActive(true)
    clear()
    setWidth(0)
    setOpacity(1)
    // Stagger the fake progress: 0 → 20 → 50 → 65 (slows down to look realistic)
    rafRef.current = requestAnimationFrame(() => {
      setWidth(20)
      timerRef.current = setTimeout(() => setWidth(50), 200)
      timerRef.current = setTimeout(() => setWidth(65), 700)
    })
  }

  function finish() {
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
  }

  // Navigation complete when pathname changes
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (activeRef.current) finish()
    }
  }, [pathname])

  // Detect navigation start via anchor clicks
  useEffect(() => {
    function onClick(e: MouseEvent) {
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

    return () => document.removeEventListener("click", onClick, true)
  }, [])

  // Don't render when completely hidden
  if (!active && opacity === 0) return null

  return (
    <div
      aria-hidden
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
