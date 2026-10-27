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
      className="flex flex-col gap-3 rounded-[22px] border p-4 sm:p-5"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="type-small-heading m-0" style={{ color: T.ink.base }}>
          {title}
        </h3>
        <p className="m-0 mt-0.5 text-sm" style={{ color: T.ink.dim }}>
          {byline}
        </p>
      </div>
      <dl className="m-0 flex flex-col gap-3">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex flex-col gap-1.5">
            <dt
              className={
                rows.length === 1 && row.label === title
                  ? "sr-only"
                  : "text-sm font-semibold"
              }
            >
              {row.label}
            </dt>
            <dd className="m-0 grid gap-2 sm:grid-cols-2">
              <span
                className="flex flex-col rounded-[14px] px-3.5 py-2.5 text-base"
                style={{
                  background: TYPE_TINT.special.bg,
                  color: TYPE_TINT.special.fg,
                }}
              >
                <span className="text-sm font-semibold">Now</span>
                <del className="wrap-break-word" style={{ color: T.ink.base }}>
                  {row.now || "Empty"}
                </del>
              </span>
              <span
                className="flex flex-col rounded-[14px] px-3.5 py-2.5 text-base"
                style={{
                  background: TYPE_TINT.public.bg,
                  color: TYPE_TINT.public.fg,
                }}
              >
                <span className="text-sm font-semibold">Suggested</span>
                <span className="wrap-break-word" style={{ color: T.ink.base }}>
                  {row.suggested || "Empty"}
                </span>
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {evidence ? (
        <p className="m-0 text-sm wrap-break-word" style={{ color: T.ink.dim }}>
          <span className="font-semibold" style={{ color: T.ink.base }}>
            Source:
          </span>{" "}
          {evidence}
        </p>
      ) : null}
      {footer ? (
        <p
          className="m-0 flex items-start gap-2 text-sm"
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
