import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

/**
 * One headline number: a dim label, a serif numeral and an optional change
 * line. `ghost` draws it as a sample on a plan gate: surface fill, the
 * numeral dimmed and no change line (the caller elides the digits).
 */
export function KpiTile({
  label,
  value,
  change,
  ghost = false,
}: {
  readonly label: string
  readonly value: string
  readonly change?: { pct: number; period: string }
  readonly ghost?: boolean
}) {
  const up = change ? change.pct >= 0 : false

  return (
    <div
      className="min-w-0 rounded-[20px] border p-4"
      style={{
        background: ghost ? T.bg.surface : T.bg.deep,
        borderColor: T.border.line,
      }}
    >
      <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
        {label}
      </p>
      <p
        className="my-2 text-4xl break-words tabular-nums"
        style={{
          fontFamily: T.font.serif,
          color: ghost ? T.ink.dim : T.ink.base,
        }}
      >
        {value}
      </p>
      {change && !ghost ? (
        <p
          className="m-0 flex items-center gap-1 text-sm"
          style={{ color: T.ink.dim }}
        >
          <Icon
            aria-hidden="true"
            height={16}
            icon={up ? "mdi:arrow-up" : "mdi:arrow-down"}
            width={16}
            style={{ color: up ? T.accent.ok : T.accent.danger }}
          />
          <span className="sr-only">{up ? "Up" : "Down"} </span>
          <span className="tabular-nums">
            {up ? "+" : ""}
            {change.pct}% vs previous {change.period}
          </span>
        </p>
      ) : null}
    </div>
  )
}
