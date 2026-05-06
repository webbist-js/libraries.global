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
    <div
      style={{
        background: "rgba(255,255,255,.025)",
        border: `1px solid ${T.border.line}`,
        borderRadius: "16px",
        padding: "20px 22px",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Panel header */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "9.5px",
            letterSpacing: ".24em",
            textTransform: "uppercase",
            color: T.ink.faint,
            marginBottom: "4px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ color: T.accent.aurora }}>§ B.06</span>
          <span>Most active</span>
        </div>
        <h4
          style={{
            fontFamily: T.font.serif,
            fontWeight: 400,
            fontSize: "22px",
            letterSpacing: "-.02em",
            margin: 0,
            lineHeight: 1.1,
            color: T.ink.base,
          }}
        >
          The most{" "}
          <em
            style={{ fontStyle: "italic", color: T.ink.dim, fontWeight: 300 }}
          >
            active.
          </em>
        </h4>
      </div>

      {/* Library rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {libraries.map((lib, i) => {
          const pct = max > 0 ? (lib.count / max) * 100 : 0
          const isFirst = i === 0
          const isLast = i === libraries.length - 1

          return (
            <div
              key={lib.entityRef}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 0",
                borderBottom: isLast ? "none" : `1px dashed ${T.border.line}`,
              }}
            >
              {/* Rank */}
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  color: isFirst ? T.accent.gold : T.ink.faint,
                  width: "16px",
                  flexShrink: 0,
                  textAlign: "right",
                }}
              >
                {i + 1}
              </span>

              {/* Name + bar */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "13px",
                    color: isFirst ? T.ink.base : T.ink.dim,
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {lib.name}
                </p>
                <div
                  style={{
                    marginTop: "4px",
                    height: "2px",
                    width: `${pct}%`,
                    borderRadius: "1px",
                    background: isFirst
                      ? T.accent.gold
                      : "rgba(255,255,255,0.12)",
                    transition: "width 600ms ease",
                  }}
                />
              </div>

              {/* Count */}
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  color: isFirst ? T.accent.gold : T.ink.low,
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
