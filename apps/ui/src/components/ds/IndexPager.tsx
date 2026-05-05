"use client"

import { T } from "@/lib/design-tokens"

interface IndexPagerProps {
  readonly page: number
  readonly totalPages: number
  readonly onPageChange: (page: number) => void
}

export function IndexPager({
  page,
  totalPages,
  onPageChange,
}: IndexPagerProps) {
  if (totalPages <= 1) return null

  // Build compact page list: always show first, last, and window around current
  const items: (number | "…")[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      items.push(i)
    } else if (items.at(-1) !== "…") {
      items.push("…")
    }
  }

  const pill = (active: boolean, disabled = false): React.CSSProperties => ({
    fontFamily: T.font.mono,
    fontSize: "11px",
    letterSpacing: ".06em",
    padding: "6px 10px",
    borderRadius: "8px",
    border: `1px solid ${active ? "rgba(127,223,255,0.3)" : T.border.line}`,
    background: active ? "rgba(127,223,255,0.1)" : "transparent",
    color: disabled ? T.ink.ghost : active ? T.accent.aurora : T.ink.dim,
    cursor: disabled ? "default" : "pointer",
    transition: "all 150ms",
  })

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        flexWrap: "wrap",
        justifyContent: "center",
        padding: "24px 0",
      }}
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={pill(false, page <= 1)}
      >
        ← Prev
      </button>

      {items.map((item, i) =>
        item === "…" ? (
          <span
            key={`ellipsis-${i}`}
            style={{
              color: T.ink.ghost,
              padding: "6px 4px",
              fontSize: "11px",
              fontFamily: T.font.mono,
            }}
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            style={pill(item === page)}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        style={pill(false, page >= totalPages)}
      >
        Next →
      </button>
    </div>
  )
}
