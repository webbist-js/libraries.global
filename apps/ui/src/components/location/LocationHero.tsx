import type React from "react"

import { Breadcrumb } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

export interface LocationHeroStat {
  label: string
  value: string | number
  note?: string
}

/** White stat chip with a serif value — v2 replacement for the dark HeroStat. */
export function LocationStatChip({
  stat,
}: {
  readonly stat: LocationHeroStat
}) {
  return (
    <div
      className="flex min-w-[132px] flex-col gap-0.5 rounded-2xl px-5 py-4"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <span
        className="text-[40px] leading-none"
        style={{ fontFamily: T.font.serif, fontWeight: 500, color: T.ink.base }}
      >
        {stat.value}
      </span>
      <span className="text-[14px] font-semibold" style={{ color: T.ink.dim }}>
        {stat.label}
      </span>
      {stat.note ? (
        <span className="text-[12px]" style={{ color: T.ink.low }}>
          {stat.note}
        </span>
      ) : null}
    </div>
  )
}

/**
 * v2 in-flow light hero for atlas location pages (continent / country /
 * region / area). Replaces the dark full-bleed `-mt-14` hero pattern.
 */
export function LocationHero({
  breadcrumbLabels,
  typeLabel,
  title,
  intro,
  stats = [],
  aside,
}: {
  readonly breadcrumbLabels?: Record<string, string>
  readonly typeLabel?: string | null
  readonly title: string
  readonly intro?: string | null
  readonly stats?: LocationHeroStat[]
  /** Optional right-column figure (globe disc, hero image). */
  readonly aside?: React.ReactNode
}) {
  return (
    <section id="overview" className="scroll-mt-24">
      <Container>
        <div className="pt-6 sm:pt-8">
          {breadcrumbLabels ? <Breadcrumb labels={breadcrumbLabels} /> : null}

          <div className="mt-5 flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
            <div className="max-w-[720px] min-w-0">
              {typeLabel ? (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[14px] font-semibold"
                  style={{
                    background: "var(--tint-national-bg)",
                    color: "var(--tint-national-fg)",
                  }}
                >
                  {typeLabel}
                </span>
              ) : null}

              <h1
                className="m-0 mt-3 text-[clamp(40px,5.4vw,68px)] leading-[1.02] tracking-[-0.02em]"
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
                  className="mt-4 mb-0 max-w-[62ch] text-[18px] leading-[1.6]"
                  style={{ color: T.ink.dim }}
                >
                  {intro}
                </p>
              ) : null}
            </div>

            {aside ? <div className="shrink-0">{aside}</div> : null}
          </div>

          {stats.length > 0 ? (
            <div className="mt-8 flex flex-wrap gap-3">
              {stats.map((stat) => (
                <LocationStatChip key={stat.label} stat={stat} />
              ))}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
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
