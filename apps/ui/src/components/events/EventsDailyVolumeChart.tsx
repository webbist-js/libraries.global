import type { DailyVolumeStat } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

interface EventsDailyVolumeChartProps {
  readonly data: DailyVolumeStat[]
}

export function EventsDailyVolumeChart({ data }: EventsDailyVolumeChartProps) {
  if (data.length < 2) return null

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const W = 600
  const H = 80
  const PADDING = 4

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - PADDING - (d.count / maxCount) * (H - PADDING * 2)

    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  // Build area path (polyline + close to bottom)
  const areaPath =
    `M 0,${H} ` +
    data
      .map((d, i) => {
        const x = (i / (data.length - 1)) * W
        const y = H - PADDING - (d.count / maxCount) * (H - PADDING * 2)

        return `L ${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(" ") +
    ` L ${W},${H} Z`

  const firstDate = new Date(data[0]!.date)
  const lastDate = new Date(data.at(-1)!.date)
  const dateRange = `${firstDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${lastDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`

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
          <span style={{ color: T.accent.aurora }}>§ B.05</span>
          <span>This period</span>
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
          Daily{" "}
          <em
            style={{ fontStyle: "italic", color: T.ink.dim, fontWeight: 300 }}
          >
            volume.
          </em>
        </h4>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="vol-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.accent.aurora} stopOpacity="0.15" />
            <stop
              offset="100%"
              stopColor={T.accent.aurora}
              stopOpacity="0.01"
            />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#vol-fill)" />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={T.accent.aurora}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

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
          marginTop: "6px",
        }}
      >
        <span>{dateRange}</span>
      </div>
    </div>
  )
}
