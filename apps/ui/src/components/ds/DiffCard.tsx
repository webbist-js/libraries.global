import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T, TYPE_TINT } from "@/lib/design-tokens"

/**
 * One suggested change for a reviewer: the field, who sent it and when,
 * "Now" (struck through, rust tint) beside "Suggested" (green tint), the
 * source, and the decision pills. Status is tint + icon + words.
 */
export function DiffCard({
  title,
  rows,
  evidence,
  byline,
  actions,
  footer,
}: {
  title: string
  rows: { label: string; now: string; suggested: string }[]
  /** The contributor's source, shown as "Source: …". */
  evidence?: string | null
  byline: string
  actions: ReactNode
  /** A line after a decision ("Published … Credited to …"). */
  footer?: ReactNode
}) {
  return (
    <article
      className="flex flex-col gap-4 rounded-[20px] border p-5"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <div>
        <h3
          className="m-0 text-[17px] font-semibold"
          style={{ color: T.ink.base }}
        >
          {title}
        </h3>
        <p className="m-0 mt-0.5 text-[14px]" style={{ color: T.ink.dim }}>
          {byline}
        </p>
      </div>
      <dl className="m-0 flex flex-col gap-3">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex flex-col gap-1.5">
            <dt className="text-[14px] font-semibold">{row.label}</dt>
            <dd className="m-0 grid gap-2 sm:grid-cols-2">
              <span
                className="flex items-start gap-2 rounded-[14px] px-3.5 py-2.5 text-[15px]"
                style={{
                  background: TYPE_TINT.special.bg,
                  color: TYPE_TINT.special.fg,
                }}
              >
                <Icon
                  aria-hidden="true"
                  icon="mdi:minus-circle-outline"
                  width={16}
                  className="mt-1 shrink-0"
                />
                <span>
                  <span className="sr-only">Now: </span>
                  <del className="wrap-break-word">{row.now || "Empty"}</del>
                </span>
              </span>
              <span
                className="flex items-start gap-2 rounded-[14px] px-3.5 py-2.5 text-[15px]"
                style={{
                  background: TYPE_TINT.public.bg,
                  color: TYPE_TINT.public.fg,
                }}
              >
                <Icon
                  aria-hidden="true"
                  icon="mdi:plus-circle-outline"
                  width={16}
                  className="mt-1 shrink-0"
                />
                <span className="wrap-break-word">
                  <span className="sr-only">Suggested: </span>
                  {row.suggested || "Empty"}
                </span>
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {evidence ? (
        <p
          className="m-0 text-[14px] wrap-break-word"
          style={{ color: T.ink.dim }}
        >
          <span className="font-semibold" style={{ color: T.ink.base }}>
            Source:
          </span>{" "}
          {evidence}
        </p>
      ) : null}
      {footer ? (
        <p
          className="m-0 flex items-start gap-2 text-[14px]"
          style={{ color: T.ink.dim }}
          role="status"
        >
          {footer}
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">{actions}</div>
      )}
    </article>
  )
}
