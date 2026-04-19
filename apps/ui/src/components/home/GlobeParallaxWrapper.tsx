"use client"

import { useEffect, useRef } from "react"

/**
 * Wraps the globe canvas and applies a subtle vertical parallax as the page
 * scrolls. Kept as a thin client component so the parent hero stays a server
 * component. The outer container handles the X-centering so we only need to
 * apply translateY here, avoiding any Tailwind transform conflicts.
 */
export function GlobeParallaxWrapper({
  children,
}: {
  readonly children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let rafId: number

    const tick = () => {
      if (ref.current) {
        // 0.18 = subtle — globe drifts ~18% of scroll distance
        ref.current.style.transform = `translateY(${window.scrollY * 0.18}px)`
      }
    }

    const onScroll = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(tick)
    }

    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <div ref={ref} className="h-full w-full will-change-transform">
      {children}
    </div>
  )
}

export default GlobeParallaxWrapper
