"use client"

import { useEffect, useState } from "react"

export function WikiProgressBar() {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const scrolled = el.scrollTop || document.body.scrollTop
      const total = el.scrollHeight - el.clientHeight
      setPct(total > 0 ? (scrolled / total) * 100 : 0)
    }
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: "56px",
        left: 0,
        height: "2px",
        width: `${pct}%`,
        background: "#7fdfff",
        boxShadow: "0 0 8px #7fdfff",
        zIndex: 50,
        transition: "width 80ms linear",
        pointerEvents: "none",
      }}
    />
  )
}
