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
  surface = false,
  headingLevel,
  className,
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
  /** Standalone results card; omit inside an existing panel. */
  readonly surface?: boolean
  readonly headingLevel?: 2 | 3 | 4
  readonly className?: string
}) {
  const headline = lead ?? message ?? "Nothing here yet"
  const Headline = headingLevel
    ? (`h${headingLevel}` as "h2" | "h3" | "h4")
    : "p"

  return (
    <div
      className={[
        "missing-content flex flex-col items-center gap-3 rounded-2xl text-center",
        compact ? "px-4 py-8" : "px-4 py-16",
        surface ? "rounded-3xl" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full"
        style={{ background: T.bg.muted, color: T.ink.dim }}
      >
        <Icon height={22} icon={icon} width={22} />
      </span>
      <Headline className="type-small-heading m-0" style={{ color: T.ink.dim }}>
        {headline}
      </Headline>
      {detail ? (
        <p
          className="m-0 max-w-md text-sm leading-[1.5]"
          style={{ fontFamily: T.font.sans, color: T.ink.dim }}
        >
          {detail}
        </p>
      ) : null}
      {action ? (
        <div className="mt-1 flex max-w-full flex-wrap items-center justify-center gap-3">
          {action}
        </div>
      ) : null}
    </div>
  )
}
