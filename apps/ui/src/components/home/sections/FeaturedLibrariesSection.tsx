import { Clock, ImageOff } from "lucide-react"
import Image from "next/image"

import GlobalLink from "@/components/global/GlobalLink"
import type { SectionIntro } from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { T, tintForLibraryType, TYPE_TINT } from "@/lib/design-tokens"
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

/** Card grounds behind a photo (or in place of one), in turn. */
const CARD_TINTS = [TYPE_TINT.public, TYPE_TINT.academic, TYPE_TINT.special]

export function FeaturedLibrariesSection({
  libraries,
  intro,
  total,
}: {
  readonly libraries?: PopulatedFeaturedLibraryData[] | null
  readonly intro: SectionIntro
  /** Published records in the index, for the "Browse all" link. */
  readonly total?: number | null
}) {
  if (!Array.isArray(libraries) || libraries.length === 0) return null

  const cards = libraries.slice(0, 3)

  return (
    <section
      id="featured"
      aria-labelledby="featured-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(80px,10vw,140px)] sm:px-8"
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
            {total
              ? `Browse all ${total.toLocaleString("en-US")} libraries`
              : "Browse all libraries"}
          </GlobalLink>
        }
      />

      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5 p-0">
        {cards.map((library, i) => {
          const ground = CARD_TINTS[i % CARD_TINTS.length]!
          const typeTint = tintForLibraryType(library.libraryType)
          const imgUrl = formatStrapiMediaUrl(library.heroImage?.url)
          const location = locationLabel(library)

          return (
            <li key={library.documentId}>
              <GlobalLink
                href={libraryHref(library)}
                className="group relative flex h-[clamp(420px,36vw,520px)] flex-col overflow-hidden rounded-[24px] border no-underline transition-colors hover:border-(--t-accent-primary)"
                style={{ background: ground.bg, borderColor: T.border.line }}
              >
                {imgUrl ? (
                  <Image
                    src={imgUrl}
                    alt={
                      library.heroImage?.alternativeText ?? library.name ?? ""
                    }
                    fill
                    sizes="(min-width: 1024px) 440px, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span
                    className="flex flex-1 flex-col items-center justify-center gap-1.5 pb-28 text-[14px] font-medium"
                    style={{ color: ground.fg }}
                  >
                    <ImageOff
                      aria-hidden="true"
                      className="size-5"
                      strokeWidth={1.6}
                    />
                    No photo yet
                  </span>
                )}

                <span className="absolute inset-x-2.5 bottom-2.5 flex flex-col gap-2 rounded-[18px] bg-white p-5">
                  <span className="flex flex-wrap gap-1.5">
                    {library.libraryType ? (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
                        style={{ background: typeTint.bg, color: typeTint.fg }}
                      >
                        {library.libraryType} library
                      </span>
                    ) : null}
                    {location ? (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
                        style={{ background: T.bg.space, color: T.ink.base }}
                      >
                        {location}
                      </span>
                    ) : null}
                  </span>

                  <h3
                    className="m-0 text-[clamp(24px,2.2vw,30px)] leading-[1.1] transition-colors group-hover:text-(--t-accent-primary)"
                    style={{
                      fontFamily: T.font.serif,
                      fontWeight: 500,
                      color: T.ink.base,
                    }}
                  >
                    {library.name}
                  </h3>

                  <span
                    className="flex items-center gap-1.5 text-[14px]"
                    style={{ color: T.ink.dim }}
                  >
                    <Clock
                      aria-hidden="true"
                      className="size-3.5 shrink-0"
                      strokeWidth={1.7}
                    />
                    {hoursLine(library)}
                  </span>
                </span>
              </GlobalLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

FeaturedLibrariesSection.displayName = "FeaturedLibrariesSection"

export default FeaturedLibrariesSection
