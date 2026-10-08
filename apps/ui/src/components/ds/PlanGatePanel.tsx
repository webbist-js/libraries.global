import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import { Badge } from "./Badge"

/**
 * The Team-plan gate on a staff page: a locked "Team plan" chip, a display
 * heading, what the plan adds as tick points, the free note, Compare plans
 * and a contact link, and an optional ghosted sample of the gated feature
 * on the right (`aria-hidden`, and never interactive: the points carry the
 * meaning).
 */
export function PlanGatePanel({
  title,
  lead,
  points,
  comingSoon,
  preview,
  compareHref,
  contactHref,
  freeNote = "Your library’s record, notices and edits stay free for every verified staff member.",
}: {
  readonly title: string
  readonly lead: string
  readonly points: string[]
  readonly comingSoon?: boolean
  /** A sample of the gated feature, drawn with placeholder data. */
  readonly preview?: ReactNode
  readonly compareHref: string
  readonly contactHref: string
  readonly freeNote?: string
}) {
  return (
    <section
      className={[
        "grid gap-8 rounded-[20px] border p-6 sm:p-8",
        preview ? "lg:grid-cols-2 lg:gap-12" : "",
      ].join(" ")}
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <div className="flex flex-col gap-5 lg:self-center">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <Badge label="Team plan" color="aurora" icon="mdi:lock-outline" />
          {comingSoon ? <Badge label="Coming soon" color="dim" /> : null}
        </p>
        <h2
          className="m-0 text-balance"
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(32px,3vw,40px)",
            fontWeight: 500,
            lineHeight: 1.08,
            letterSpacing: "-0.015em",
            color: T.ink.base,
          }}
        >
          {title}
        </h2>
        <p
          className="m-0 text-[16px] leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          {lead}
        </p>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
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
        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          {freeNote}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={compareHref}
            className="inline-flex min-h-11 items-center rounded-full px-5 font-semibold no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
            style={{ background: T.accent.primary, color: T.bg.deep }}
          >
            Compare plans
          </Link>
          <a
            href={contactHref}
            className="inline-flex min-h-11 items-center rounded-full border bg-white px-5 font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            Ask about Team for your service
          </a>
        </div>
      </div>
      {preview ? (
        <div className="min-w-0 lg:self-center">
          <p
            className="m-0 mb-3 flex items-center gap-1.5 text-[13.5px]"
            style={{ color: T.ink.dim }}
          >
            <Icon aria-hidden="true" icon="mdi:flask-outline" width={16} />
            Sample data
          </p>
          <div aria-hidden="true" className="pointer-events-none select-none">
            {preview}
          </div>
        </div>
      ) : null}
    </section>
  )
}
