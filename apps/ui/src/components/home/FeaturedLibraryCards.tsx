import Image from "next/image"

import GlobalLink from "@/components/global/GlobalLink"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { getLibraryLocationLabel } from "@/components/home/homepage.helpers"
import { buildLibraryPath } from "@/lib/library-helpers"
import type { PopulatedFeaturedLibraryData } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

export function FeaturedLibraryCards({
  libraries,
}: {
  readonly libraries?: PopulatedFeaturedLibraryData[] | null
}) {
  if (!Array.isArray(libraries) || libraries.length === 0) {
    return null
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {libraries.map((library, index) => {
        const imageUrl = formatStrapiMediaUrl(library.heroImage?.url)
        const locationLabel = getLibraryLocationLabel(library)

        return (
          <GlobalLink
            key={library.documentId ?? library.slug ?? index}
            href={buildLibraryPath(library) ?? library.website ?? undefined}
            fallbackAs="div"
            className={cn(
              homepagePanelClassName,
              "group relative isolate min-h-[24rem] overflow-hidden rounded-[32px] p-0 transition-[border-color,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-white/16 hover:shadow-[0_34px_110px_rgba(4,10,26,0.5)] focus-visible:border-white/16 focus-visible:shadow-[0_34px_110px_rgba(4,10,26,0.5)] focus-visible:outline-none sm:min-h-[28rem] xl:min-h-[30rem]"
            )}
          >
            <div className="absolute inset-0">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={library.heroImage?.alternativeText ?? library.name}
                  fill
                  className="object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.055] group-focus-visible:scale-[1.055]"
                />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(120,180,255,0.18),transparent_30%),linear-gradient(180deg,rgba(28,40,71,0.9),rgba(10,14,24,1))]" />
              )}

              {/* Base overlay — deepens on hover for cinematic contrast */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_28%),linear-gradient(180deg,rgba(6,9,20,0.08),rgba(6,9,20,0.18)_34%,rgba(5,8,22,0.78)_72%,rgba(5,8,22,0.97)_100%)] transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 group-focus-visible:opacity-100" />

              {/* Bottom gradient — drifts down slightly on hover, adding depth */}
              <div className="absolute inset-x-0 bottom-0 h-[62%] bg-[linear-gradient(180deg,rgba(5,8,22,0),rgba(5,8,22,0.18)_18%,rgba(5,8,22,0.86)_72%,rgba(5,8,22,0.98)_100%)] opacity-95 transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-1.5 group-hover:opacity-100 group-focus-visible:translate-y-1.5 group-focus-visible:opacity-100" />
            </div>

            <div className="relative z-10 h-full p-5 sm:p-6">
              {/* Top bar — always visible */}
              <div className="absolute inset-x-5 top-5 flex items-start justify-between gap-4 sm:inset-x-6 sm:top-6">
                {library.libraryType ? (
                  <span className="rounded-full border border-white/10 bg-black/28 px-3 py-1.5 text-[11px] tracking-[0.18em] text-white/70 uppercase backdrop-blur-md transition-colors duration-500 group-hover:border-white/14 group-hover:text-white/88">
                    {library.libraryType}
                  </span>
                ) : (
                  <span />
                )}

                {library.continent?.code ? (
                  <span className="pt-1 text-xs tracking-[0.16em] text-white/48 uppercase transition-colors duration-500 group-hover:text-white/70">
                    {library.continent.code}
                  </span>
                ) : null}
              </div>

              {/* Bottom content */}
              <div className="absolute inset-x-5 bottom-5 max-w-[22rem] sm:inset-x-6 sm:bottom-6">
                {/* Title + location slide up to make room for description */}
                <div className="space-y-1.5 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-4 group-focus-visible:-translate-y-4">
                  <h3 className="max-w-[12ch] text-[clamp(1.8rem,3vw,2.65rem)] leading-[0.96] font-semibold tracking-[-0.05em] text-white">
                    {library.shortName || library.name}
                  </h3>

                  {locationLabel ? (
                    <p className="text-sm text-white/58 transition-colors duration-500 group-hover:text-white/72 sm:text-base">
                      {locationLabel}
                    </p>
                  ) : null}
                </div>

                {/* Description — staggered reveal after title lifts */}
                {library.summary ? (
                  <div className="mt-0 grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity,margin-top] delay-[60ms] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:mt-3.5 group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-visible:mt-3.5 group-focus-visible:grid-rows-[1fr] group-focus-visible:opacity-100">
                    <div className="overflow-hidden">
                      <p className="max-w-[26ch] translate-y-4 text-sm leading-6 text-white/74 transition-transform delay-[100ms] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-focus-visible:translate-y-0 sm:text-[15px] sm:leading-7">
                        {library.summary}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </GlobalLink>
        )
      })}
    </div>
  )
}

FeaturedLibraryCards.displayName = "FeaturedLibraryCards"

export default FeaturedLibraryCards
