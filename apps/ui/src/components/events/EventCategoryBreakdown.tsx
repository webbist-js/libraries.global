import { EVENT_TYPE_META } from "@/components/events/EventTypeChip"
import type { CategoryStat } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`

  return String(n)
}

interface EventCategoryBreakdownProps {
  readonly categories: CategoryStat[]
}

export function EventCategoryBreakdown({
  categories,
}: EventCategoryBreakdownProps) {
  if (!categories.length) return null

  const total = categories.reduce((s, c) => s + c.count, 0)

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
          <span style={{ color: T.accent.aurora }}>§ B.02</span>
          <span>By category</span>
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
          What&rsquo;s{" "}
          <em
            style={{ fontStyle: "italic", color: T.ink.dim, fontWeight: 300 }}
          >
            on.
          </em>
        </h4>
      </div>

      {/* Stacked colour bar */}
      <div
        style={{
          display: "flex",
          height: "6px",
          width: "100%",
          overflow: "hidden",
          borderRadius: "3px",
          marginBottom: "18px",
        }}
      >
        {categories.map((c) => {
          const meta = EVENT_TYPE_META[c.type] ?? EVENT_TYPE_META.other!
          const pct = total > 0 ? (c.count / total) * 100 : 0

          return (
            <div
              key={c.type}
              title={`${meta.label}: ${formatCount(c.count)}`}
              style={{
                width: `${pct}%`,
                background: meta.color,
                flexShrink: 0,
                transition: "width 600ms ease",
              }}
            />
          )
        })}
      </div>

      {/* Category rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {categories.map((c, i) => {
          const meta = EVENT_TYPE_META[c.type] ?? EVENT_TYPE_META.other!
          const pct = total > 0 ? (c.count / total) * 100 : 0
          const isLast = i === categories.length - 1

          return (
            <div
              key={c.type}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 0",
                borderBottom: isLast ? "none" : `1px dashed ${T.border.line}`,
              }}
            >
              {/* Pip */}
              <span
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: meta.color,
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />

              {/* Name + sub count */}
              <span
                style={{
                  flex: 1,
                  fontSize: "13px",
                  color: T.ink.base,
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  minWidth: 0,
                }}
              >
                {meta.label}
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9.5px",
                    color: T.ink.faint,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                  }}
                >
                  {formatCount(c.count)} events
                </span>
              </span>

              {/* Percentage (large serif) */}
              <span
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "18px",
                  color: T.ink.base,
                  letterSpacing: "-.01em",
                  flexShrink: 0,
                }}
              >
                {pct.toFixed(1)}
                <span
                  style={{
                    color: T.ink.faint,
                    fontSize: "11px",
                    marginLeft: "2px",
                  }}
                >
                  %
                </span>
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "14px",
          paddingTop: "12px",
          borderTop: `1px dashed ${T.border.line}`,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: T.font.mono,
          fontSize: "10px",
          color: T.ink.low,
          letterSpacing: ".14em",
          textTransform: "uppercase",
        }}
      >
        <span>By event type</span>
      </div>
    </div>
  )
}
