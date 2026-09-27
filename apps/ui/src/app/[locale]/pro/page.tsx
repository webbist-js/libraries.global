import { Icon } from "@iconify/react"
import { EARNED_PRO_HOLD_DAYS } from "@repo/access"
import type { Metadata } from "next"
import { headers } from "next/headers"
import type { Locale } from "next-intl"

import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { PlansTable } from "@/components/pro/PlansTable"
import { PlanStatusBanner } from "@/components/pro/PlanStatusBanner"
import { getSessionSSR } from "@/lib/auth-server"
import { CONTACT_EMAIL } from "@/lib/constants"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { buildMetadata } from "@/lib/seo/metadata"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Plans and Pro",
    description:
      "Library facts are free, always. Membership keeps the index running; Pro adds analysis on top. See the plans and the ways to get Pro free.",
    path: "pro",
    locale,
  })
}

const mailto = (subject: string) =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`

type RouteStatus = "live" | "soon" | "request"

const STATUS: Record<
  RouteStatus,
  { icon: string; bg: string; fg: string; label: string }
> = {
  live: {
    icon: "mdi:check-circle-outline",
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

const FREE_ROUTES: {
  title: string
  status: RouteStatus
  body: string
  link: { label: string; href: string }
}[] = [
  {
    title: "Verified library staff, students and charities",
    status: "soon",
    body: "Pro is free for people who work in libraries, for students and for charities, renewed each year. Self-serve verification is coming soon; until then, write to us from your work, student or charity address.",
    link: { label: "Write to us", href: mailto("Pro verification") },
  },
  {
    title: "Earned at Archivist tier",
    status: "live",
    body: `Reach Archivist tier through accepted contributions and Pro switches on by itself. If you drop below Archivist, Pro holds for ${EARNED_PRO_HOLD_DAYS} days.`,
    link: { label: "Start contributing", href: "/contribute" },
  },
  {
    title: "Grants for press and partners",
    status: "request",
    body: "Journalists, researchers on partner projects and partner organisations can ask the team for a Pro grant.",
    link: { label: "Ask for a grant", href: mailto("Pro grant") },
  },
]

const FAQ: { q: string; a: string }[] = [
  {
    q: "What stays free?",
    a: "Everything factual. Every library record, with its hours and services, search, the map, lists and the open-data downloads stay free for everyone, signed in or not. Contributing is free too.",
  },
  {
    q: "Does Pro change my role or how my edits are reviewed?",
    a: "No. Money never buys trust. Pro doesn’t award points, raise your tier, change your contributor role or skip review.",
  },
  {
    q: "Is VAT added at checkout?",
    a: "No. The Supporter and Pro prices shown are what you pay. Team is invoiced, and its price is quoted ex VAT.",
  },
  {
    q: "Can I cancel?",
    a: "Nobody can be charged yet. Once checkout exists, you’ll be able to cancel at any time, with a no-questions refund within 14 days of paying.",
  },
]

const H2_STYLE = {
  fontFamily: T.font.serif,
  fontSize: "clamp(26px,3vw,32px)",
  fontWeight: 500,
  letterSpacing: "-0.01em",
  color: T.ink.base,
} as const

function StatusChip({ status }: { readonly status: RouteStatus }) {
  const s = STATUS[status]

  return (
    <span
      className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      <Icon aria-hidden="true" height={14} icon={s.icon} width={14} />
      {s.label}
    </span>
  )
}

function GetProFree() {
  return (
    <section aria-labelledby="pro-free-h">
      <h2 id="pro-free-h" className="m-0" style={H2_STYLE}>
        Get Pro free
      </h2>
      <p
        className="mt-2 mb-6 max-w-[62ch] text-[16px] leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        If you have complimentary Pro, you’re never asked to pay.
      </p>
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
        {FREE_ROUTES.map((route) => (
          <li
            key={route.title}
            className="flex flex-col gap-3 rounded-[20px] border bg-white p-5"
            style={{ borderColor: T.border.line }}
          >
            <StatusChip status={route.status} />
            <h3
              className="m-0 text-[20px] leading-tight"
              style={{ fontFamily: T.font.serif, fontWeight: 500 }}
            >
              {route.title}
            </h3>
            <p
              className="m-0 text-[15px] leading-[1.55]"
              style={{ color: T.ink.dim }}
            >
              {route.body}
            </p>
            {route.link.href.startsWith("mailto:") ? (
              <a
                className="mt-auto w-fit text-[15px] font-semibold underline underline-offset-[3px]"
                href={route.link.href}
                style={{ color: T.accent.primary }}
              >
                {route.link.label}
              </a>
            ) : (
              <GlobalLink
                className="mt-auto w-fit text-[15px] font-semibold underline underline-offset-[3px]"
                href={route.link.href}
                style={{ color: T.accent.primary }}
              >
                {route.link.label}
              </GlobalLink>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Faq() {
  return (
    <section aria-labelledby="pro-faq-h">
      <h2 id="pro-faq-h" className="m-0 mb-6" style={H2_STYLE}>
        Questions
      </h2>
      <dl
        className="m-0 rounded-[20px] border bg-white"
        style={{ borderColor: T.border.line }}
      >
        {FAQ.map((item, i) => (
          <div
            key={item.q}
            className="px-5 py-4 sm:px-6"
            style={
              i > 0 ? { borderTop: `1px solid ${T.border.divider}` } : undefined
            }
          >
            <dt className="text-[16px] font-semibold">{item.q}</dt>
            <dd
              className="m-0 mt-1.5 max-w-[72ch] text-[15px] leading-[1.6]"
              style={{ color: T.ink.dim }}
            >
              {item.a}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default async function ProPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await getSessionSSR(await headers())
  const user = session?.user
  // A signed-in session missing its plan counts as free (missing means deny).
  const currentPlan = user ? (user.plan ?? "free") : "public"

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale as Locale} />
      <main className="flex flex-1 flex-col">
        <PageHero
          breadcrumb={[
            { label: "Home", href: "/" },
            { label: "Plans and Pro" },
          ]}
          eyebrow="Membership"
          eyebrowIcon="mdi:hand-heart-outline"
          lead="Library facts are free, always. Membership keeps the index running; Pro adds analysis on top."
          title="Plans and *Pro*"
        />
        <Container className="flex flex-col gap-14 py-12 sm:py-16">
          <PlanStatusBanner plan={user?.plan} planSource={user?.planSource} />

          <section aria-labelledby="plans-h">
            <h2 id="plans-h" className="m-0 mb-6" style={H2_STYLE}>
              Plans
            </h2>
            <PlansTable currentPlan={currentPlan} />
          </section>

          <GetProFree />
          <Faq />
        </Container>
      </main>
    </div>
  )
}
