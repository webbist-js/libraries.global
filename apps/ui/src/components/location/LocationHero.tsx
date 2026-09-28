import { Icon } from "@iconify/react"
import type React from "react"

import { Breadcrumb } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

export interface LocationHeroStat {
  label: string
  value: string | number
  note?: string
}

/** White stat card with a serif value. */
function LocationStatCard({ stat }: { readonly stat: LocationHeroStat }) {
  return (
    <div
      className="flex min-w-0 flex-col gap-1.5 rounded-2xl px-4 py-3.5"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <span
        className="text-[30px] leading-none tracking-[-0.01em]"
        style={{ fontFamily: T.font.serif, fontWeight: 500, color: T.ink.base }}
      >
        {stat.value}
      </span>
      <span
        className="text-[13.5px] leading-[1.35] font-semibold"
        style={{ color: T.ink.base }}
      >
        {stat.label}
      </span>
      {stat.note ? (
        <span className="text-[12.5px]" style={{ color: T.ink.low }}>
          {stat.note}
        </span>
      ) : null}
    </div>
  )
}

/**
 * v2 hero band for atlas location pages (continent / country / region /
 * area): breadcrumb, then the type pill, serif title, lead, stat cards and
 * actions on the left, with an optional figure (the hero map) on the right.
 */
export function LocationHero({
  breadcrumbLabels,
  typeLabel,
  typeIcon,
  code,
  title,
  intro,
  stats = [],
  actions,
  aside,
}: {
  readonly breadcrumbLabels?: Record<string, string>
  readonly typeLabel?: string | null
  /** Iconify id for the type pill, e.g. "mdi:earth". */
  readonly typeIcon?: string
  /** Short technical code shown in the pill, e.g. "GB-ENG". */
  readonly code?: string | null
  readonly title: string
  readonly intro?: string | null
  readonly stats?: LocationHeroStat[]
  /** Buttons under the stats (search, add). */
  readonly actions?: React.ReactNode
  /** Optional right-column figure (the hero map). */
  readonly aside?: React.ReactNode
}) {
  return (
    <section
      id="overview"
      className="scroll-mt-24 border-b"
      style={{ background: T.bg.space, borderColor: T.border.line }}
    >
      <Container className="pt-6 pb-[clamp(36px,5vw,56px)] sm:pt-8">
        {breadcrumbLabels ? <Breadcrumb labels={breadcrumbLabels} /> : null}

        <div
          className={cn(
            "mt-6 grid gap-x-12 gap-y-8 lg:items-center",
            aside && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
          )}
        >
          <div className="min-w-0">
            {typeLabel ? (
              <p className="m-0 mb-4">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[14px] font-semibold"
                  style={{
                    background: T.bg.deep,
                    borderColor: T.border.line,
                    color: T.ink.base,
                  }}
                >
                  {typeIcon ? (
                    <Icon
                      aria-hidden="true"
                      height={15}
                      icon={typeIcon}
                      style={{ color: T.accent.primary }}
                      width={15}
                    />
                  ) : null}
                  {typeLabel}
                  {code ? (
                    <span
                      className="text-[12px] font-medium"
                      style={{ fontFamily: T.font.mono, color: T.ink.dim }}
                    >
                      {code}
                    </span>
                  ) : null}
                </span>
              </p>
            ) : null}

            <h1
              className="m-0 text-[clamp(44px,6vw,76px)] leading-[1.02] tracking-[-0.02em] text-balance"
              style={{
                fontFamily: T.font.serif,
                fontWeight: 500,
                color: T.ink.base,
              }}
            >
              {title}
            </h1>

            {intro ? (
              <p
                className="mt-4 mb-0 max-w-[58ch] text-[17px] leading-[1.6]"
                style={{ color: T.ink.dim }}
              >
                {intro}
              </p>
            ) : null}

            {stats.length > 0 ? (
              <div
                className={cn(
                  "mt-6 grid gap-2.5",
                  stats.length >= 3
                    ? "grid-cols-2 sm:grid-cols-3"
                    : "grid-cols-2"
                )}
              >
                {stats.map((stat) => (
                  <LocationStatCard key={stat.label} stat={stat} />
                ))}
              </div>
            ) : null}

            {actions ? (
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {actions}
              </div>
            ) : null}
          </div>

          {aside ? <div className="min-w-0">{aside}</div> : null}
        </div>
      </Container>
    </section>
  )
}

/** Primary / secondary pill buttons for the hero's action row. */
export function LocationHeroAction({
  href,
  icon,
  children,
  primary = false,
}: {
  readonly href: string
  readonly icon: string
  readonly children: React.ReactNode
  readonly primary?: boolean
}) {
  return (
    <GlobalLink
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-semibold transition-colors",
        primary
          ? "bg-(--t-accent-primary) text-white hover:bg-(--t-accent-primary-hover)"
          : "border border-(--t-border-hi) bg-(--t-bg-deep) text-(--t-ink-base) hover:bg-(--t-bg-surface)"
      )}
    >
      <Icon aria-hidden="true" height={16} icon={icon} width={16} />
      {children}
    </GlobalLink>
  )
}

/** v2 serif section heading for atlas sections. */
export function LocationSectionHeading({
  title,
  description,
  count,
}: {
  readonly title: string
  readonly description?: string | null
  readonly count?: string | null
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
      <h2
        className="m-0 text-[28px] sm:text-[32px]"
        style={{ fontFamily: T.font.serif, fontWeight: 500, color: T.ink.base }}
      >
        {title}
        {count ? (
          <span
            className="ml-3 align-middle text-[15px]"
            style={{
              fontFamily: T.font.sans,
              color: T.ink.low,
              fontWeight: 400,
            }}
          >
            {count}
          </span>
        ) : null}
      </h2>
      {description ? (
        <p
          className="m-0 max-w-[52ch] text-[15px] leading-[1.6]"
          style={{ color: T.ink.dim }}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}

/** Honest empty state for locations with no records yet. */
export function LocationEmptyState({ name }: { readonly name: string }) {
  return (
    <div
      className="rounded-3xl px-8 py-12 text-center"
      style={{ border: `1px dashed ${T.border.hi}`, background: T.bg.deep }}
    >
      <h3
        className="m-0 text-[24px]"
        style={{ fontFamily: T.font.serif, fontWeight: 500, color: T.ink.base }}
      >
        No records yet
      </h3>
      <p
        className="mx-auto mt-2 mb-5 max-w-[46ch] text-[16px]"
        style={{ color: T.ink.dim }}
      >
        We haven&rsquo;t documented any libraries in {name} yet. Know one? Help
        us put it on the map.
      </p>
      <GlobalLink
        href="/contribute"
        className="inline-flex items-center rounded-full bg-(--t-accent-primary) px-6 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
      >
        Add a missing library
      </GlobalLink>
    </div>
  )
}
