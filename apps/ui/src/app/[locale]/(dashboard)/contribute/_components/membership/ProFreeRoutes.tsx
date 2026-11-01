import { Icon } from "@iconify/react"
import { EARNED_PRO_ACTIVITY_DAYS, EARNED_PRO_POINTS } from "@repo/access"
import { useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { CONTACT_EMAIL } from "@/lib/constants"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { useMembershipContent } from "@/lib/localized-plans"

import { PlanSectionHeader } from "./PlanBits"

const mailto = (subject: string) =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`

type RouteStatus = "live" | "proRequest" | "request"

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
  proRequest: {
    icon: "mdi:email-outline",
    bg: TYPE_TINT.neutral.bg,
    fg: TYPE_TINT.neutral.fg,
    label: "Free Pro on request",
  },
  request: {
    icon: "mdi:email-outline",
    bg: TYPE_TINT.national.bg,
    fg: TYPE_TINT.national.fg,
    label: "On request",
  },
}

const LINK_PILL =
  "mt-auto inline-flex h-10 w-fit items-center gap-1.5 rounded-full border bg-(--t-bg-deep) px-4 text-sm font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"

/** The three ways to hold Pro without paying. */
export function ProFreeRoutes() {
  const m = useMembershipContent()
  const ROUTES: {
    title: string
    status: RouteStatus
    icon: string
    tint: { bg: string; fg: string }
    body: string
    link: { label: string; href: string }
  }[] = [
    {
      title: m("copy.staffTitle"),
      status: "proRequest",
      icon: "mdi:bank-outline",
      tint: TYPE_TINT.academic,
      body: m("copy.staffBody"),
      link: { label: m("copy.write"), href: mailto("Pro verification") },
    },
    {
      title: m("copy.earnedTitle"),
      status: "live",
      icon: "mdi:star-outline",
      tint: TYPE_TINT.public,
      body: m("copy.earnedBody", {
        days: EARNED_PRO_ACTIVITY_DAYS,
        points: EARNED_PRO_POINTS,
      }),
      link: { label: m("copy.start"), href: "/contribute" },
    },
    {
      title: m("copy.grantTitle"),
      status: "request",
      icon: "mdi:file-document-outline",
      tint: TYPE_TINT.special,
      body: m("copy.grantBody"),
      link: { label: m("copy.grant"), href: mailto("Pro grant") },
    },
  ]

  const tUi = useUiTranslations("ui")

  return (
    <section
      aria-labelledby="get-pro-free-h"
      className="scroll-mt-28"
      id="get-pro-free"
    >
      <PlanSectionHeader
        id="get-pro-free-h"
        sub={m("copy.freeProLead")}
        title={tUi("get_pro_free")}
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
              className="flex flex-col gap-3 rounded-[22px] border bg-(--t-bg-deep) p-6"
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
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold"
                  style={{ background: status.bg, color: status.fg }}
                >
                  <Icon
                    aria-hidden="true"
                    height={14}
                    icon={status.icon}
                    width={14}
                  />
                  {m(`copy.${route.status}`)}
                </span>
              </div>
              <h3 className="type-h3 m-0">{route.title}</h3>
              <p
                className="m-0 mb-2 text-sm leading-[1.55]"
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
