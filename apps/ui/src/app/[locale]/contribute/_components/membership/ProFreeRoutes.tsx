import { Icon } from "@iconify/react"
import { EARNED_PRO_HOLD_DAYS } from "@repo/access"

import GlobalLink from "@/components/global/GlobalLink"
import { CONTACT_EMAIL } from "@/lib/constants"
import { T, TYPE_TINT } from "@/lib/design-tokens"

import { PlanSectionHeader } from "./PlanBits"

const mailto = (subject: string) =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`

type RouteStatus = "live" | "soon" | "request"

const STATUS: Record<
  RouteStatus,
  { icon: string; bg: string; fg: string; label: string }
> = {
  live: {
    icon: "mdi:check",
    bg: TYPE_TINT.public.bg,
    fg: TYPE_TINT.public.fg,
    label: "Live",
  },
  soon: {
    icon: "mdi:clock-outline",
    bg: TYPE_TINT.neutral.bg,
    fg: TYPE_TINT.neutral.fg,
    label: "Self-serve coming soon",
  },
  request: {
    icon: "mdi:email-outline",
    bg: TYPE_TINT.national.bg,
    fg: TYPE_TINT.national.fg,
    label: "On request",
  },
}

const ROUTES: {
  title: string
  status: RouteStatus
  icon: string
  tint: { bg: string; fg: string }
  body: string
  link: { label: string; href: string }
}[] = [
  {
    title: "Verified library staff, students and charities",
    status: "soon",
    icon: "mdi:bank-outline",
    tint: TYPE_TINT.academic,
    body: "Pro is free for people who work in libraries, for students and for charities, renewed each year. Self-serve verification is coming soon; until then, write to us from your work, student or charity address.",
    link: { label: "Write to us", href: mailto("Pro verification") },
  },
  {
    title: "Earned at Archivist tier",
    status: "live",
    icon: "mdi:star-outline",
    tint: TYPE_TINT.public,
    body: `Reach Archivist tier through accepted contributions and Pro switches on by itself. If you drop below Archivist, Pro holds for ${EARNED_PRO_HOLD_DAYS} days.`,
    link: { label: "Start contributing", href: "/contribute" },
  },
  {
    title: "Grants for press and partners",
    status: "request",
    icon: "mdi:file-document-outline",
    tint: TYPE_TINT.special,
    body: "Journalists, researchers on partner projects and partner organisations can ask the team for a Pro grant.",
    link: { label: "Ask for a grant", href: mailto("Pro grant") },
  },
]

const LINK_PILL =
  "mt-auto inline-flex h-10 w-fit items-center gap-1.5 rounded-full border bg-white px-4 text-[14.5px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"

/** The three ways to hold Pro without paying. */
export function ProFreeRoutes() {
  return (
    <section aria-labelledby="get-pro-free-h" id="get-pro-free">
      <PlanSectionHeader
        id="get-pro-free-h"
        sub="If you qualify for complimentary Pro, you’re never asked to pay."
        title="Get Pro free"
      />
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
        {ROUTES.map((route) => {
          const status = STATUS[route.status]
          const content = (
            <>
              {route.link.label}
              <Icon
                aria-hidden="true"
                height={16}
                icon="mdi:arrow-right"
                width={16}
              />
            </>
          )

          return (
            <li
              key={route.title}
              className="flex flex-col gap-3 rounded-[22px] border bg-white p-6"
              style={{ borderColor: T.border.line }}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-[12px]"
                  style={{ background: route.tint.bg, color: route.tint.fg }}
                >
                  <Icon height={20} icon={route.icon} width={20} />
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
                  style={{ background: status.bg, color: status.fg }}
                >
                  <Icon
                    aria-hidden="true"
                    height={14}
                    icon={status.icon}
                    width={14}
                  />
                  {status.label}
                </span>
              </div>
              <h3
                className="m-0 text-[21px] leading-tight"
                style={{ fontFamily: T.font.serif, fontWeight: 500 }}
              >
                {route.title}
              </h3>
              <p
                className="m-0 mb-2 text-[14.5px] leading-[1.55]"
                style={{ color: T.ink.dim }}
              >
                {route.body}
              </p>
              {route.link.href.startsWith("mailto:") ? (
                <a
                  className={LINK_PILL}
                  href={route.link.href}
                  style={{ borderColor: T.border.hi, color: T.ink.base }}
                >
                  {content}
                </a>
              ) : (
                <GlobalLink
                  className={LINK_PILL}
                  href={route.link.href}
                  style={{ borderColor: T.border.hi, color: T.ink.base }}
                >
                  {content}
                </GlobalLink>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
