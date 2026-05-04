import type { HeatmapCell } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const HOUR_LABELS = new Set(["00", "03", "06", "09", "12", "15", "18", "21"])

interface TimeOfDayHeatmapProps {
  readonly cells: HeatmapCell[]
}

export function TimeOfDayHeatmap({ cells }: TimeOfDayHeatmapProps) {
  if (!cells.length) return null

  const max = Math.max(...cells.map((c) => c.count), 1)

  // Build lookup: dow → hour → count
  const lookup = new Map<number, Map<number, number>>()
  for (const cell of cells) {
    if (!lookup.has(cell.dow)) lookup.set(cell.dow, new Map())
    lookup.get(cell.dow)!.set(cell.hour, cell.count)
  }

  // Find peak
  const peakCell = cells.reduce(
    (best, c) => (c.count > best.count ? c : best),
    cells[0]!
  )
  const peakLabel = `${DAY_LABELS[peakCell.dow]} ${String(peakCell.hour).padStart(2, "0")}:00`

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
            § 02 ·
          </span>
          <h2
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.4rem",
              fontWeight: 400,
              color: T.ink.base,
            }}
          >
            Time of{" "}
            <em style={{ fontStyle: "italic", color: T.ink.dim }}>day.</em>
          </h2>
        </div>
        <div className="text-right">
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".1em",
              color: T.ink.faint,
            }}
          >
            Peak
          </p>
          <p
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.2rem",
              color: T.accent.aurora,
            }}
          >
            {peakLabel}
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: "320px" }}>
          {/* Hour labels across top */}
          <div className="mb-1 flex" style={{ paddingLeft: "36px" }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="flex-1 text-center"
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "8px",
                  color: HOUR_LABELS.has(String(h).padStart(2, "0"))
                    ? T.ink.ghost
                    : "transparent",
                  letterSpacing: ".08em",
                }}
              >
                {String(h).padStart(2, "0")}
              </div>
            ))}
          </div>

          {/* Rows: one per day */}
          {DAY_LABELS.map((dayLabel, dow) => (
            <div key={dow} className="mb-0.5 flex items-center gap-1">
              {/* Day label */}
              <div
                className="w-8 shrink-0 text-right"
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "8px",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: T.ink.ghost,
                  paddingRight: "4px",
                }}
              >
                {dayLabel}
              </div>

              {/* Cells */}
              {Array.from({ length: 24 }, (_, hour) => {
                const count = lookup.get(dow)?.get(hour) ?? 0
                const intensity = max > 0 ? count / max : 0

                return (
                  <div
                    key={hour}
                    title={`${dayLabel} ${String(hour).padStart(2, "0")}:00 — ${count} events`}
                    className="flex-1 rounded-sm transition-opacity duration-200"
                    style={{
                      aspectRatio: "1",
                      height: "14px",
                      background:
                        intensity > 0
                          ? `rgba(127,223,255,${0.08 + intensity * 0.72})`
                          : "rgba(255,255,255,0.04)",
                      border:
                        dow === peakCell.dow && hour === peakCell.hour
                          ? `1px solid rgba(127,223,255,0.6)`
                          : "1px solid transparent",
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
