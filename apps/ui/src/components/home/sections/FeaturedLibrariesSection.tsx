import GlobalLink from "@/components/global/GlobalLink"
import type { SectionIntro } from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { FeaturedLibraryCard } from "@/components/library/FeaturedLibraryCard"
import type { OpeningTimesValue } from "@/components/library/library-page.helpers"
import { T } from "@/lib/design-tokens"
import type { PopulatedFeaturedLibraryData } from "@/lib/strapi-api/content/server"

function libraryHref(library: PopulatedFeaturedLibraryData): string | null {
  const { continent, country, region, slug } = library
  if (continent?.slug && country?.slug && region?.slug && slug) {
    return `/${continent.slug}/${country.slug}/${region.slug}/${slug}`
  }

  return null
}

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
      className="w-full bg-white"
    >
      <div className="mx-auto w-full max-w-[1360px] px-4 sm:px-8">
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
          {cards.map((library, index) => (
            <li key={library.documentId}>
              <FeaturedLibraryCard
                name={library.name}
                libraryType={library.libraryType}
                city={library.city}
                countryName={library.country?.name}
                imageUrl={library.heroImage?.url}
                imageAlt={library.heroImage?.alternativeText}
                openingTimes={library.openingTimes as OpeningTimesValue | null}
                href={libraryHref(library)}
                index={index}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

FeaturedLibrariesSection.displayName = "FeaturedLibrariesSection"

export default FeaturedLibrariesSection
