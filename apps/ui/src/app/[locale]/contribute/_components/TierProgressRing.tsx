import { T } from "@/lib/design-tokens"

const SIZE = 72
const STROKE = 6
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function TierProgressRing({
  percent,
  label,
}: {
  readonly percent: number
  readonly label: string
}) {
  const filled = CIRCUMFERENCE * (1 - percent / 100)

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ flexShrink: 0 }}
      aria-label={`${percent}% progress to next tier`}
      role="img"
    >
      {/* Track */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={T.ink.ghost}
        strokeWidth={STROKE}
      />
      {/* Progress arc */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={T.accent.violet}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={filled}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
      {/* Centre label */}
      <text
        x={SIZE / 2}
        y={SIZE / 2}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontFamily: T.font.mono,
          fontSize: "13px",
          fill: T.ink.base,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </text>
    </svg>
  )
}
