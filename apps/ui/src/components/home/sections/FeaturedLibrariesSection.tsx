import { libraryTypeName } from "@repo/shared-data"

import GlobalLink from "@/components/global/GlobalLink"
import {
  homepageLinkAttributes,
  homepageContentAttributes,
} from "@/components/home/homepage.analytics"
import type { SectionIntro } from "@/components/home/homepage.types"
import { PillarCarousel } from "@/components/home/PillarCarousel"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { FeaturedLibraryCard } from "@/components/library/FeaturedLibraryCard"
import type { OpeningTimesValue } from "@/components/library/library-page.helpers"
import { CarouselItem } from "@/components/ui/carousel"
import type { PopulatedFeaturedLibraryData } from "@/lib/strapi-api/content/server"

export function FeaturedLibrariesSection({
  libraries,
  intro,
  total,
}: {
  readonly libraries?: PopulatedFeaturedLibraryData[] | null
  readonly intro: SectionIntro
  readonly total?: number | null
}) {
  const cards = (libraries ?? []).filter(
    (library) =>
      library.continent?.slug &&
      library.country?.slug &&
      library.region?.slug &&
      library.slug
  )
  if (!cards.length) return null

  return (
    <section
      id="featured"
      aria-labelledby="featured-title"
      className="home-featured"
      data-homepage-surface="paper"
    >
      <div className="home-frame">
        <SectionHeader
          id="featured-title"
          intro={intro}
          action={
            <GlobalLink
              href="/libraries"
              {...homepageLinkAttributes("/libraries")}
              className="home-text-link"
            >
              {total
                ? `Browse all ${total.toLocaleString("en-GB")} libraries`
                : "Browse all libraries"}{" "}
            </GlobalLink>
          }
        />
      </div>
      <PillarCarousel>
        {cards.map((library, index) => {
          return (
            <CarouselItem
              key={library.documentId}
              className="home-pillar-slide"
              aria-label={`${index + 1} of ${cards.length}`}
            >
              <FeaturedLibraryCard
                href={`/${library.continent!.slug}/${library.country!.slug}/${library.region!.slug}/${library.slug}`}
                linkProps={{
                  ...homepageContentAttributes("library", library.documentId),
                  lang: library.locale ?? undefined,
                }}
                name={library.name}
                libraryType={libraryTypeName(library.libraryType)}
                city={library.city}
                countryName={library.country?.name}
                imageUrl={library.heroImage?.url}
                imageAlt={library.heroImage?.alternativeText}
                openingTimes={library.openingTimes as OpeningTimesValue | null}
                summary={library.summary}
                index={index}
                revealDetails
                imageSizes="(min-width: 761px) 48vw, 88vw"
              />
            </CarouselItem>
          )
        })}
      </PillarCarousel>
    </section>
  )
}

export default FeaturedLibrariesSection
