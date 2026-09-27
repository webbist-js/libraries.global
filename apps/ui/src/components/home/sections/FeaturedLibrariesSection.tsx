import { Clock, Landmark } from "lucide-react"
import Image from "next/image"

import GlobalLink from "@/components/global/GlobalLink"
import type { CtaBand, SectionIntro } from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import type { PopulatedFeaturedLibraryData } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

function libraryHref(library: PopulatedFeaturedLibraryData): string | null {
  const { continent, country, region, slug } = library
  if (continent?.slug && country?.slug && region?.slug && slug) {
    return `/${continent.slug}/${country.slug}/${region.slug}/${slug}`
  }

  return null
}

function locationLabel(library: PopulatedFeaturedLibraryData): string {
  return [library.city, library.country?.name].filter(Boolean).join(", ")
}

const DAY_ABBR: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
}

type OpeningDays = {
  days?: {
    day?: string
    enabled?: boolean
    timeframes?: { startTime?: string; endTime?: string }[]
  }[]
} | null

/** Honest one-line hours summary: names what's documented, admits what isn't. */
function hoursLine(library: PopulatedFeaturedLibraryData): string {
  const days = (library.openingTimes as OpeningDays)?.days
  const documented = (days ?? []).filter(
    (d) => d.enabled && (d.timeframes?.length ?? 0) > 0
  )
  if (documented.length === 0) return "Hours not added yet"

  const first = documented[0]!
  const label = DAY_ABBR[first.day ?? ""] ?? ""
  const times = (first.timeframes ?? [])
    .map((tf) => `${tf.startTime}–${tf.endTime}`)
    .join(", ")

  if (documented.length >= 7) return `Open daily · ${label} ${times}`

  return `${[label, times].filter(Boolean).join(" ")} · other days not added`
}

export function FeaturedLibrariesSection({
  libraries,
  intro,
  prompt,
}: {
  readonly libraries?: PopulatedFeaturedLibraryData[] | null
  readonly intro: SectionIntro
  readonly prompt: CtaBand
}) {
  if (!Array.isArray(libraries) || libraries.length === 0) return null

  const cards = libraries.slice(0, 3)

  return (
    <section
      id="featured"
      aria-labelledby="featured-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8"
    >
      <SectionHeader
        id="featured-title"
        intro={intro}
        action={
          <GlobalLink
            href="/libraries"
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Browse all libraries
          </GlobalLink>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5">
        {cards.map((library) => {
          const tint = tintForLibraryType(library.libraryType)
          const imgUrl = formatStrapiMediaUrl(library.heroImage?.url)
          const location = locationLabel(library)

          return (
            <GlobalLink
              key={library.documentId}
              href={libraryHref(library)}
              className="group flex flex-col overflow-hidden rounded-[24px] border bg-white no-underline transition-colors hover:border-(--t-accent-primary)"
              style={{ borderColor: T.border.line }}
            >
              {/* Image panel — real photo, or a plain tinted panel */}
              <div className="relative m-2 h-[176px] overflow-hidden rounded-[16px]">
                {imgUrl ? (
                  <Image
                    src={imgUrl}
                    alt={
                      library.heroImage?.alternativeText ?? library.name ?? ""
                    }
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{ background: tint.bg }}
                  />
                )}
                <span
                  aria-hidden="true"
                  className="absolute top-3 left-3 flex size-8 items-center justify-center rounded-full bg-white/85"
                >
                  <Landmark
                    className="size-4"
                    strokeWidth={1.7}
                    style={{ color: tint.fg }}
                  />
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2.5 p-[14px_20px_22px]">
                <div className="flex flex-wrap gap-2">
                  {library.libraryType ? (
                    <span
                      className="rounded-full px-2.5 py-1 text-[13px] font-semibold"
                      style={{ background: tint.bg, color: tint.fg }}
                    >
                      {library.libraryType} library
                    </span>
                  ) : null}
                  {location ? (
                    <span
                      className="rounded-full px-2.5 py-1 text-[13px] font-medium"
                      style={{ background: T.bg.muted, color: T.ink.base }}
                    >
                      {location}
                    </span>
                  ) : null}
                </div>

                <h3
                  className="m-0 text-[26px] leading-[1.15]"
                  style={{
                    fontFamily: T.font.serif,
                    fontWeight: 500,
                    color: T.ink.base,
                  }}
                >
                  {library.name}
                </h3>

                {library.summary ? (
                  <p
                    className="m-0 line-clamp-2 text-[15px] leading-[1.55]"
                    style={{ color: T.ink.dim }}
                  >
                    {library.summary}
                  </p>
                ) : null}

                <p
                  className="m-0 mt-auto flex items-center gap-1.5 pt-1 text-[14px]"
                  style={{ color: T.ink.low }}
                >
                  <Clock
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                    strokeWidth={1.7}
                  />
                  {hoursLine(library)}
                </p>
              </div>
            </GlobalLink>
          )
        })}
      </div>

      {prompt.title ? (
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border px-5 py-4"
          style={{ background: T.bg.muted, borderColor: T.border.line }}
        >
          <p className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
            <strong style={{ color: T.ink.base }}>{prompt.title}</strong>
            {prompt.text ? ` ${prompt.text}` : null}
          </p>
          {prompt.primaryLabel && prompt.primaryHref ? (
            <GlobalLink
              href={prompt.primaryHref}
              className="rounded-full px-4 py-2.5 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
              style={{ background: T.accent.primary }}
            >
              {prompt.primaryLabel}
            </GlobalLink>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

FeaturedLibrariesSection.displayName = "FeaturedLibrariesSection"

export default FeaturedLibrariesSection
