import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { HealthRow } from "@/lib/staff/types"

import { TONES } from "./Notice"

const PILL =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border bg-(--t-bg-deep) px-4 text-sm font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"

/**
 * The record-health card (sans heading, so the sidebar sits under the main
 * column): a serif "{done} of {total}" score, then one row
 * per check with a status mark (green tick or amber "to do" dot), the
 * label, a sub-line and an outlined pill action. Status is never colour
 * alone: the mark carries an icon and a text label.
 */
export function HealthList({
  title,
  rows,
  score,
  renderAction,
  headingId = "record-health-heading",
  compact = false,
}: {
  readonly headingId?: string
  readonly compact?: boolean
  readonly title: string
  readonly rows: HealthRow[]
  readonly score?: { done: number; total: number }
  readonly renderAction?: (row: HealthRow) => ReactNode
}) {
  const tUi = useUiTranslations("ui")

  return (
    <section
      className={
        compact ? "staff-health-compact" : "rounded-[28px] border p-5 sm:p-6"
      }
      style={{ background: T.bg.deep, borderColor: T.border.line }}
      aria-labelledby={headingId}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id={headingId}
          className="type-panel-title m-0"
          style={{ color: T.ink.base }}
        >
          {title}
        </h2>
        {score ? (
          <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
            <span
              className="text-[26px] leading-none"
              style={{ fontFamily: T.font.sans, color: T.ink.base }}
            >
              {score.done}
            </span>{" "}
            of {score.total}
          </p>
        ) : null}
      </div>
      <ul className="m-0 mt-3 list-none p-0">
        {rows.map((row) => {
          const ok = row.status === "ok"

          return (
            <li
              key={row.key}
              className="flex items-center gap-3 border-t py-3.5"
              style={{ borderColor: T.border.divider }}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: ok ? TONES.ok.bg : TONES.warn.bg,
                  color: ok ? TONES.ok.fg : TONES.warn.fg,
                }}
                title={ok ? tUi("done") : "To do"}
              >
                <Icon
                  aria-hidden="true"
                  icon={ok ? "mdi:check" : "mdi:exclamation"}
                  width={18}
                  height={18}
                />
                <span className="sr-only">{ok ? tUi("done") : "To do"}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className="text-base font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {row.label}
                </span>
                <span className="text-sm" style={{ color: T.ink.dim }}>
                  {row.note}
                </span>
              </span>
              {renderAction?.(row) ??
                (row.action ? (
                  <Link
                    href={row.action.href}
                    className={PILL}
                    style={{ borderColor: T.border.hi, color: T.ink.base }}
                  >
                    {row.action.label}
                  </Link>
                ) : null)}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
