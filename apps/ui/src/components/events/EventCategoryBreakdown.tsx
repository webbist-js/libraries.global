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
    <div>
      {/* Section header */}
      <div className="mb-5 flex items-center gap-2">
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          § 03 ·
        </span>
        <h2
          style={{
            fontFamily: T.font.serif,
            fontSize: "1.4rem",
            fontWeight: 400,
            color: T.ink.base,
          }}
        >
          What&rsquo;s{" "}
          <em style={{ fontStyle: "italic", color: T.ink.dim }}>on.</em>
        </h2>
      </div>

      {/* Stacked bar */}
      <div className="mb-5 flex h-2 w-full overflow-hidden rounded-full">
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
                opacity: 0.6,
                flexShrink: 0,
                transition: "width 600ms ease",
              }}
            />
          )
        })}
      </div>

      {/* List */}
      <div className="space-y-2">
        {categories.map((c) => {
          const meta = EVENT_TYPE_META[c.type] ?? EVENT_TYPE_META.other!
          const pct = total > 0 ? (c.count / total) * 100 : 0

          return (
            <div
              key={c.type}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ background: meta.color, opacity: 0.7 }}
                />
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".1em",
                    color: T.ink.dim,
                  }}
                >
                  {meta.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  style={{
                    fontFamily: T.font.serif,
                    fontSize: "15px",
                    color: T.ink.base,
                  }}
                >
                  {formatCount(c.count)}
                </span>
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    color: T.ink.ghost,
                  }}
                >
                  {pct.toFixed(0)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
