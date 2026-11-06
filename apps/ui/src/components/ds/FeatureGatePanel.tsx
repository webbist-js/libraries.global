import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import { Badge } from "./Badge"

type GateLink = { readonly href: string; readonly label: string }

/**
 * Explains a tool the viewer can't use yet on a staff page: a chip naming
 * what it needs, a display heading, what it adds as tick points, a note,
 * a primary step and an optional second one, and an optional ghosted sample
 * of the feature on the right (`aria-hidden`, never interactive: the points
 * carry the meaning). It never sells anything: staff tools come from
 * verified staff access, and workspaces are free.
 */
export function FeatureGatePanel({
  badge,
  title,
  lead,
  points,
  preview,
  previewCaption = "Illustration of the feature",
  note,
  action,
  secondary,
}: {
  readonly badge: string
  readonly title: string
  readonly lead: string
  readonly points: string[]
  /** A sample of the feature, drawn with placeholder data. */
  readonly preview?: ReactNode
  readonly previewCaption?: string
  readonly note?: string
  readonly action: GateLink
  readonly secondary?: GateLink
}) {
  return (
    <section
      className={[
        "grid gap-8 rounded-[28px] border p-5 sm:p-10",
        preview ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10" : "",
      ].join(" ")}
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <div className="flex flex-col gap-5 lg:self-center">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <Badge
            label={badge}
            color="aurora"
            icon="mdi:account-group-outline"
          />
        </p>
        <h2 className="type-h2 m-0 text-balance" style={{ color: T.ink.base }}>
          {title}
        </h2>
        <p
          className="m-0 text-base leading-[1.65]"
          style={{ color: T.ink.dim }}
        >
          {lead}
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-base">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <Icon
                aria-hidden="true"
                icon="mdi:check"
                width={18}
                height={18}
                className="mt-0.5 shrink-0"
                style={{ color: T.accent.ok }}
              />
              <span style={{ color: T.ink.base }}>{point}</span>
            </li>
          ))}
        </ul>
        {note ? (
          <p className="m-0 text-base" style={{ color: T.ink.dim }}>
            {note}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Link
            href={action.href}
            className="inline-flex min-h-12 items-center justify-center rounded-full px-6 text-center font-semibold no-underline transition-colors hover:bg-(--t-action-primary-hover)"
            style={{ background: T.action.primary, color: T.ink.inverse }}
          >
            {action.label}
          </Link>
          {secondary ? (
            <Link
              href={secondary.href}
              className="inline-flex min-h-12 items-center justify-center rounded-full border bg-(--t-bg-deep) px-6 py-2 text-center font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
              style={{ borderColor: T.border.hi, color: T.ink.base }}
            >
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </div>
      {preview ? (
        <div className="min-w-0 lg:self-center">
          <div
            aria-hidden="true"
            className="pointer-events-none rounded-[24px] border bg-(--t-bg-surface) p-4 select-none"
            style={{ borderColor: T.border.line }}
          >
            {preview}
          </div>
          <p className="m-0 mt-2 text-sm" style={{ color: T.ink.dim }}>
            {previewCaption}
          </p>
        </div>
      ) : null}
    </section>
  )
}
