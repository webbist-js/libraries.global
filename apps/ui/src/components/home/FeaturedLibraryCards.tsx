import Image from "next/image"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { buildLibraryPath } from "@/lib/library-helpers"
import type { PopulatedFeaturedLibraryData } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

function pad(n: number) {
  return String(n + 1).padStart(2, "0")
}

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

        // Build location tag string
        const locationParts = [
          library.city,
          library.country?.name,
          library.libraryType,
          (library as { foundedYear?: string | null }).foundedYear
            ? `Est. ${(library as { foundedYear?: string | null }).foundedYear}`
            : null,
        ].filter(Boolean)

        return (
          <GlobalLink
            key={library.documentId ?? library.slug ?? index}
            href={href}
            fallbackAs="div"
            className="group relative h-[460px] w-[78vw] min-w-[260px] flex-none snap-start overflow-hidden border-r transition-all duration-700 last:border-r-0 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none sm:h-[500px] sm:w-[42vw] lg:w-[28vw] xl:w-[26vw]"
            style={{ background: T.bg.surface, borderColor: T.border.line }}
          >
            {/* Background image */}
            <div className="absolute inset-0">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={library.heroImage?.alternativeText ?? library.name}
                  fill
                  className="object-cover opacity-35 transition-opacity duration-700 group-hover:opacity-45"
                />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(60,100,200,0.12),transparent_50%)]" />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.2)_0%,rgba(5,8,22,0.55)_50%,rgba(5,8,22,0.95)_100%)]" />
            </div>

            {/* Card number badge — top left */}
            <div className="absolute top-5 left-5 flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] font-mono text-[11px] text-white/50 backdrop-blur-sm">
              {pad(index)}
            </div>

            {/* Continent code — top right */}
            {library.continent?.code ? (
              <div className="absolute top-5 right-5 font-mono text-[10px] leading-[1.6] tracking-[0.08em] text-white/30 uppercase">
                {library.continent.code}
              </div>
            ) : null}

            {/* Bottom content */}
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
              <div className="mb-4 h-px bg-white/10" />

              <h3 className="mb-2 font-[family-name:var(--font-fraunces)] text-[1.9rem] leading-[1.05] font-semibold tracking-[-0.02em] text-white">
                {library.shortName || library.name}
              </h3>

              {locationParts.length > 0 ? (
                <p className="mb-4 text-[11px] tracking-[0.08em] text-white/45 uppercase">
                  {locationParts.join(" · ")}
                </p>
              ) : null}
            </div>
          </GlobalLink>
        )
      })}
    </div>
  )
}

FeaturedLibraryCards.displayName = "FeaturedLibraryCards"

export default FeaturedLibraryCards
