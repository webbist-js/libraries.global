import type { HeatmapCell } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

// Hours to display as bars (waking hours, 2-hour intervals)
const DISPLAY_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22]

interface TimeOfDayHeatmapProps {
  readonly cells: HeatmapCell[]
}

export function TimeOfDayHeatmap({ cells }: TimeOfDayHeatmapProps) {
  if (!cells.length) return null

  // Aggregate counts by hour across all days
  const byHour = new Map<number, number>()
  for (const cell of cells) {
    byHour.set(cell.hour, (byHour.get(cell.hour) ?? 0) + cell.count)
  }

  const maxCount = Math.max(...Array.from(byHour.values()), 1)

  // Find peak hour
  let peakHour = 0
  let peakCount = 0
  for (const [hour, count] of byHour) {
    if (count > peakCount) {
      peakCount = count
      peakHour = hour
    }
  }
  const peakLabel = `${String(peakHour).padStart(2, "0")}:00 local`

  const totalToday = Array.from(byHour.values()).reduce((s, v) => s + v, 0)

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
          <span style={{ color: T.accent.aurora }}>§ B.03</span>
          <span>Time of day</span>
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
          When the{" "}
          <em
            style={{ fontStyle: "italic", color: T.ink.dim, fontWeight: 300 }}
          >
            doors open.
          </em>
        </h4>
      </div>

      {/* Bar chart */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "6px",
          height: "120px",
          borderBottom: `1px solid ${T.border.line}`,
          marginBottom: "10px",
          padding: "10px 4px 0",
        }}
      >
        {DISPLAY_HOURS.map((hour) => {
          const count = byHour.get(hour) ?? 0
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
          const isPeak = hour === peakHour

          return (
            <div
              key={hour}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "4px",
                height: "100%",
              }}
            >
              <div
                title={`${String(hour).padStart(2, "0")}:00 — ${count} events`}
                style={{
                  width: "100%",
                  height: `${Math.max(pct, 3)}%`,
                  borderRadius: "3px 3px 0 0",
                  background: isPeak
                    ? `linear-gradient(180deg, ${T.accent.gold}, rgba(232,201,138,.2))`
                    : `linear-gradient(180deg, ${T.accent.aurora}, rgba(127,223,255,.2))`,
                  boxShadow: isPeak
                    ? "0 0 16px rgba(232,201,138,.4)"
                    : undefined,
                  transition: "height 500ms ease",
                }}
              />
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  color: isPeak ? T.accent.gold : T.ink.low,
                  letterSpacing: ".06em",
                  paddingBottom: "4px",
                }}
              >
                {String(hour).padStart(2, "0")}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: T.font.mono,
          fontSize: "10px",
          color: T.ink.low,
          letterSpacing: ".14em",
          textTransform: "uppercase",
        }}
      >
        <span>
          Peak · <b style={{ color: T.accent.gold }}>{peakLabel}</b>
        </span>
        <span>{totalToday.toLocaleString()} events</span>
      </div>
    </div>
  )
}
