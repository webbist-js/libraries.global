import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

/**
 * A tinted stat tile: icon in a white circle, a large serif numeral, and
 * the label in the tint's ink. Profile tabs and My submissions use it.
 */
export function StatCard({
  label,
  value,
  bg,
  fg,
  icon,
  compactValue = false,
}: {
  readonly label: string
  readonly value: string
  /** Tile fill, e.g. `var(--tint-public-bg)`. */
  readonly bg: string
  /** Icon and label colour, e.g. `var(--tint-public-fg)`. */
  readonly fg: string
  readonly icon: string
  /** Smaller numeral for long text values (e.g. tier names). */
  readonly compactValue?: boolean
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-2.5 rounded-[20px] px-5 py-[18px]"
      style={{ background: bg }}
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full"
        style={{ background: "var(--t-bg-deep)", color: fg }}
      >
        <Icon icon={icon} width={19} height={19} />
      </span>
      <span
        className="truncate"
        style={{
          font: compactValue ? T.type.h2 : T.type.stat,
          color: T.ink.base,
        }}
      >
        {value}
      </span>
      <span className="text-base font-semibold" style={{ color: fg }}>
        {label}
      </span>
    </div>
  )
}
