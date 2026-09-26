import { LibraryCard } from "@/components/ds/LibraryCard"
import { buildLibraryPath } from "@/lib/library-helpers"
import type { PopulatedFeaturedLibraryData } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export function FeaturedLibraryCards({
  libraries,
}: {
  readonly libraries?: PopulatedFeaturedLibraryData[] | null
}) {
  if (!Array.isArray(libraries) || libraries.length === 0) {
    return null
  }

  return (
    <div className="flex snap-x snap-mandatory gap-px overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden">
      {libraries.map((library, index) => {
        const imageUrl = formatStrapiMediaUrl(library.heroImage?.url)
        const href = buildLibraryPath(library) ?? library.website ?? undefined

        return (
          <LibraryCard
            key={library.documentId ?? library.slug ?? index}
            documentId={library.documentId ?? library.slug ?? String(index)}
            slug={library.slug}
            name={library.name ?? ""}
            shortName={library.shortName}
            libraryType={library.libraryType}
            city={library.city}
            countryName={library.country?.name}
            continentCode={library.continent?.code}
            foundedYear={
              (library as { foundedYear?: string | null }).foundedYear ?? null
            }
            heroImageUrl={imageUrl ?? null}
            heroImageAlt={library.heroImage?.alternativeText ?? library.name}
            href={href ?? null}
            index={index}
            variant="featured"
          />
        )
      })}
    </div>
  )
}

FeaturedLibraryCards.displayName = "FeaturedLibraryCards"

export default FeaturedLibraryCards
