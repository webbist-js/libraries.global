import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

/**
 * An honest empty state: a tinted icon, a bold lead, a dim line and an
 * optional next step. `message` alone (the older call) becomes the lead.
 */
export function EmptyState({
  message,
  lead,
  detail,
  icon = "mdi:tray-arrow-down",
  action,
  compact,
}: {
  /** The one-line lead (kept for older callers). */
  readonly message?: string
  /** The bold lead, e.g. "Nothing connected yet". Wins over `message`. */
  readonly lead?: string
  /** A dim line under the lead: what will appear here and when. */
  readonly detail?: string
  /** Iconify id for the tinted circle, e.g. "mdi:calendar-blank-outline". */
  readonly icon?: string
  /** The next step: a pill link or button. */
  readonly action?: ReactNode
  /** Tighter padding, for a card or a panel. */
  readonly compact?: boolean
}) {
  const headline = lead ?? message ?? "Nothing here yet"

  return (
    <div
      className={[
        "flex flex-col items-center gap-3 text-center",
        compact ? "px-4 py-8" : "px-4 py-16",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full"
        style={{ background: T.bg.muted, color: T.ink.dim }}
      >
        <Icon height={22} icon={icon} width={22} />
      </span>
      <p
        className="m-0 text-[16px] font-semibold"
        style={{ fontFamily: T.font.sans, color: T.ink.base }}
      >
        {headline}
      </p>
      {detail ? (
        <p
          className="m-0 max-w-md text-[14px] leading-[1.5]"
          style={{ fontFamily: T.font.sans, color: T.ink.dim }}
        >
          {detail}
        </p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
