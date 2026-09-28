import type { OpeningTimesValue } from "@/components/library/library-page.helpers"
import { LocationLibraryCard } from "@/components/location/LocationLibraryCard"
import { buildLibraryPath } from "@/lib/library-helpers"
import type { PopulatedFeaturedLibraryData } from "@/lib/strapi-api/content/server"

/** "Libraries worth knowing" on continent and country pages, as a card grid. */
export function LocationFeaturedLibraries({
  libraries,
  placeFor,
}: {
  readonly libraries?: PopulatedFeaturedLibraryData[] | null
  /** The chip beside the type badge, e.g. the library's country or town. */
  readonly placeFor: (library: PopulatedFeaturedLibraryData) => string | null
}) {
  if (!Array.isArray(libraries) || libraries.length === 0) return null

  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {libraries.map((library, index) => (
        <li key={library.documentId ?? library.slug ?? index}>
          <LocationLibraryCard
            library={{
              ...library,
              // Strapi types the custom field as raw JSON.
              openingTimes: library.openingTimes as OpeningTimesValue | null,
            }}
            href={buildLibraryPath(library) ?? library.website ?? null}
            place={placeFor(library)}
          />
        </li>
      ))}
    </ul>
  )
}
