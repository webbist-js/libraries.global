import type { EventsStats } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

function formatLarge(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`

  return String(n)
}

function StatCell({
  value,
  label,
  note,
  accent,
}: {
  value: string
  label: string
  note?: string
  accent?: boolean
}) {
  return (
    <div
      className="flex flex-col gap-1.5 px-6 py-5"
      style={{
        borderRight: `1px solid ${T.border.line}`,
      }}
    >
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "9px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: T.ink.ghost,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: accent ? T.accent.aurora : T.ink.base,
          fontWeight: 400,
        }}
      >
        {value}
      </span>
      {note ? (
        <span
          style={{
            fontSize: "11px",
            color: T.ink.faint,
            fontFamily: T.font.sans,
          }}
        >
          {note}
        </span>
      ) : null}
    </div>
  )
}

export function EventsStatsBar({ stats }: { stats: EventsStats }) {
  return (
    <div
      className="grid grid-cols-2 border-b border-(--t-border-line) lg:grid-cols-4"
      style={{ borderTop: `1px solid ${T.border.line}` }}
    >
      <StatCell
        label="Upcoming events"
        value={formatLarge(stats.totalEvents)}
        note={`${formatLarge(stats.totalThisWeek)} this week`}
      />
      <StatCell
        label="Free to attend"
        value={`${stats.percentFree}%`}
        note={`${formatLarge(stats.totalEvents - Math.round((stats.totalEvents * stats.percentFree) / 100))} ticketed`}
        accent
      />
      <StatCell
        label="Peak time"
        value={stats.peakSlot ?? "—"}
        note={
          stats.peakCount
            ? `${formatLarge(stats.peakCount)} concurrent`
            : undefined
        }
      />
      <StatCell
        label="This week"
        value={formatLarge(stats.totalThisWeek)}
        note="across all libraries"
      />
    </div>
  )
}
