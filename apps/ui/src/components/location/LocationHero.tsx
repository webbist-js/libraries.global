import { Icon } from "@iconify/react"
import type React from "react"

import { RecordMetrics } from "@/components/dashboard/RecordMetrics"
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

/**
 * v2 hero band for atlas location pages (continent / country / region /
 * area): breadcrumb, then the type pill, serif title, lead, stat cards and
 * actions on the left, with an optional figure (the hero map) on the right.
 */
export function LocationHero({
  typeLabel,
  typeIcon,
  code,
  title,
  untranslatedLocale = null,
  intro,
  stats = [],
  actions,
  aside,
  search,
}: {
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
  readonly search?: { level: "continent" | "country" | "region"; slug: string }
}) {
  return (
    <section id="overview" className="location-record-overview">
      <div className="record-hero">
        <Container className="record-hero-inner">
          <div
            className={cn(
              "record-hero-layout",
              !aside && "record-hero-without-media"
            )}
          >
            <div className="min-w-0">
              {typeLabel ? (
                <p className="record-hero-badges mt-0">
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
                tabIndex={-1}
                className="type-page-compact m-0 text-balance"
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
                  className="mt-3 mb-0 max-w-[58ch] text-base leading-relaxed"
                  style={{ color: T.ink.dim }}
                >
                  {intro}
                </p>
              ) : null}

              {search ? <PlaceSearchForm name={title} {...search} /> : null}

              {actions ? (
                <div className="mt-6 flex flex-wrap items-center gap-2.5">
                  {actions}
                </div>
              ) : null}
            </div>

            {aside ? <div className="min-w-0 lg:grid">{aside}</div> : null}
          </div>
        </Container>
      </div>
      {stats.length ? (
        <RecordMetrics items={stats.map((stat) => ({ ...stat }))} />
      ) : null}
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
          ? "bg-(--t-action-primary) text-white hover:bg-(--t-action-primary-hover)"
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
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <h2 className="type-small-heading m-0" style={{ color: T.ink.base }}>
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
        className="inline-flex items-center rounded-full bg-(--t-action-primary) px-6 py-2.5 text-base font-semibold text-white transition-colors hover:bg-(--t-action-primary-hover)"
      >
        Add a missing library
      </GlobalLink>
    </div>
  )
}
