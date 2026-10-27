import { Icon } from "@iconify/react"
import type React from "react"

import { Breadcrumb } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { NotTranslatedNote } from "@/components/global/NotTranslatedNote"
import { PlaceSearchForm } from "@/components/location/PlaceSearchForm"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

export interface LocationHeroStat {
  label: string
  value: string | number
  note?: string
}

/** White stat card with a serif value. */
function LocationStatCard({
  stat,
  className,
}: {
  readonly stat: LocationHeroStat
  readonly className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[140px] min-w-0 flex-col justify-end gap-1.5 rounded-2xl px-4 py-4",
        className
      )}
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <span
        className="text-[34px] leading-none tracking-[-0.01em]"
        style={{ fontFamily: T.font.sans, fontWeight: 500, color: T.ink.base }}
      >
        {stat.value}
      </span>
      <span
        className="text-sm leading-[1.35] font-semibold"
        style={{ color: T.ink.base }}
      >
        {stat.label}
      </span>
      {stat.note ? (
        <span className="text-sm" style={{ color: T.ink.low }}>
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
  untranslatedLocale = null,
  intro,
  stats = [],
  actions,
  aside,
  contribution,
  search,
}: {
  readonly breadcrumbLabels?: Record<string, string>
  readonly typeLabel?: string | null
  /** Iconify id for the type pill, e.g. "mdi:earth". */
  readonly typeIcon?: string
  /** Short technical code shown in the pill, e.g. "GB-ENG". */
  readonly code?: string | null
  readonly title: string
  readonly untranslatedLocale?: string | null
  readonly intro?: string | null
  readonly stats?: LocationHeroStat[]
  /** Buttons under the stats (search, add). */
  readonly actions?: React.ReactNode
  /** Optional right-column figure (the hero map). */
  readonly aside?: React.ReactNode
  readonly contribution?: React.ReactNode
  readonly search?: { level: "continent" | "country" | "region"; slug: string }
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
            "mt-6 grid gap-x-10 gap-y-8 lg:items-stretch",
            aside && "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
          )}
        >
          <div className="min-w-0">
            {typeLabel ? (
              <p className="hero-eyebrow mt-0">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold"
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
                      className="text-xs font-medium"
                      style={{ fontFamily: T.font.mono, color: T.ink.dim }}
                    >
                      {code}
                    </span>
                  ) : null}
                </span>
              </p>
            ) : null}

            <h1
              className="type-h1 m-0 text-balance"
              style={{
                color: T.ink.base,
              }}
            >
              {title}
            </h1>

            {untranslatedLocale ? (
              <NotTranslatedNote locale={untranslatedLocale} />
            ) : null}

            {intro ? (
              <p
                className="mt-4 mb-0 max-w-[58ch] text-lg leading-[1.6]"
                style={{ color: T.ink.dim }}
              >
                {intro}
              </p>
            ) : null}

            {search ? <PlaceSearchForm name={title} {...search} /> : null}

            {stats.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {stats.map((stat, index) => (
                  <LocationStatCard
                    key={stat.label}
                    stat={stat}
                    className={
                      stats.length === 3 && index === 2
                        ? "col-span-2"
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : null}

            {actions ? (
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {actions}
              </div>
            ) : null}
          </div>

          {aside ? <div className="min-w-0 lg:grid">{aside}</div> : null}
        </div>
        {contribution ? <div className="mt-8">{contribution}</div> : null}
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
        "inline-flex min-h-12 items-center gap-2 rounded-full px-5 py-2.5 text-base font-semibold transition-colors",
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
      <h2 className="type-h2 m-0" style={{ color: T.ink.base }}>
        {title}
        {count ? (
          <span
            className="ml-3 align-middle text-base"
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
          className="m-0 max-w-[52ch] text-base leading-[1.6]"
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
      <h3 className="type-h3 m-0" style={{ color: T.ink.base }}>
        No records yet
      </h3>
      <p
        className="mx-auto mt-2 mb-5 max-w-[46ch] text-base"
        style={{ color: T.ink.dim }}
      >
        We haven&rsquo;t documented any libraries in {name} yet. Know one? Help
        us put it on the map.
      </p>
      <GlobalLink
        href="/contribute"
        className="inline-flex items-center rounded-full bg-(--t-accent-primary) px-6 py-2.5 text-base font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
      >
        Add a missing library
      </GlobalLink>
    </div>
  )
}
