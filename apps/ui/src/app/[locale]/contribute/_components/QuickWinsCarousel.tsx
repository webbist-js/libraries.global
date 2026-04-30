"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"
import type { QuickWin } from "@/lib/types/profile"

import { QuickWinCard } from "./QuickWinCard"

const PAGE_SIZE = 4

export function QuickWinsCarousel({ wins }: { readonly wins: QuickWin[] }) {
  const [page, setPage] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const totalPages = Math.ceil(wins.length / PAGE_SIZE)

  const prev = useCallback(() => setPage((p) => Math.max(0, p - 1)), [])
  const next = useCallback(
    () => setPage((p) => Math.min(totalPages - 1, p + 1)),
    [totalPages]
  )

  // Keyboard navigation
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    el.addEventListener("keydown", handler)

    return () => el.removeEventListener("keydown", handler)
  }, [prev, next])

  const visibleWins = wins.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div ref={containerRef} tabIndex={-1} style={{ outline: "none" }}>
      {/* Counter + arrows */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          Curated for you · {page + 1} of {totalPages}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          {(["←", "→"] as const).map((arrow, i) => {
            const disabled = i === 0 ? page === 0 : page >= totalPages - 1

            return (
              <button
                key={arrow}
                onClick={i === 0 ? prev : next}
                disabled={disabled}
                aria-label={i === 0 ? "Previous page" : "Next page"}
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  border: `1px solid ${T.border.line}`,
                  background: T.bg.deep,
                  color: disabled ? T.ink.ghost : T.ink.dim,
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontFamily: T.font.sans,
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color 150ms, border-color 150ms",
                  opacity: disabled ? 0.3 : 1,
                }}
              >
                {arrow}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cards grid */}
      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        style={{ alignItems: "stretch" }}
      >
        {visibleWins.map((win) => (
          <QuickWinCard key={win.winId} win={win} />
        ))}
      </div>
    </div>
  )
}
