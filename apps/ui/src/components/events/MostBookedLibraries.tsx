import type { LibraryStat } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`

  return String(n)
}

interface MostBookedLibrariesProps {
  readonly libraries: LibraryStat[]
}

export function MostBookedLibraries({ libraries }: MostBookedLibrariesProps) {
  if (!libraries.length) return null

  const max = libraries[0]?.count ?? 1

  return (
    <div>
      {/* Section header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            § 05 ·
          </span>
          <h2
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.4rem",
              fontWeight: 400,
              color: T.ink.base,
            }}
          >
            The most{" "}
            <em style={{ fontStyle: "italic", color: T.ink.dim }}>active.</em>
          </h2>
        </div>
      </div>

      <div className="space-y-1">
        {libraries.map((lib, i) => {
          const pct = max > 0 ? (lib.count / max) * 100 : 0

          return (
            <div
              key={lib.entityRef}
              className="flex items-center gap-4 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-(--t-bg-surface)"
            >
              {/* Rank */}
              <span
                className="w-5 shrink-0 text-right"
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  color: i === 0 ? T.accent.gold : T.ink.ghost,
                }}
              >
                {i + 1}
              </span>

              {/* Name + bar */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" style={{ color: T.ink.dim }}>
                  {lib.name}
                </p>
                {/* Mini fill bar */}
                <div
                  className="mt-1 h-px rounded-full"
                  style={{
                    width: `${pct}%`,
                    background:
                      i === 0 ? T.accent.gold : "rgba(255,255,255,0.15)",
                    transition: "width 600ms ease",
                  }}
                />
              </div>

              {/* Count */}
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  color: i === 0 ? T.accent.gold : T.ink.low,
                  flexShrink: 0,
                }}
              >
                {formatCount(lib.count)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
