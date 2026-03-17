import type { Data } from "@repo/strapi-types"
import Image from "next/image"

import GlobalLink from "@/components/global/GlobalLink"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { getLibraryLocationLabel } from "@/components/home/homepage.helpers"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

export function FeaturedLibraryCards({
  libraries,
}: {
  readonly libraries?: Data.ContentType<"api::library.library">[] | null
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
            href={library.website ?? undefined}
            fallbackAs="div"
            className={cn(
              homepagePanelClassName,
              "group relative isolate min-h-[24rem] overflow-hidden rounded-[32px] p-0 transition-[border-color,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-white/16 hover:shadow-[0_34px_110px_rgba(4,10,26,0.4)] focus-visible:border-white/16 focus-visible:shadow-[0_34px_110px_rgba(4,10,26,0.4)] focus-visible:outline-none sm:min-h-[28rem] xl:min-h-[30rem]"
            )}
          >
            <div className="absolute inset-0">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={library.heroImage?.alternativeText ?? library.name}
                  fill
                  className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.035] group-focus-visible:scale-[1.035]"
                />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(120,180,255,0.18),transparent_30%),linear-gradient(180deg,rgba(28,40,71,0.9),rgba(10,14,24,1))]" />
              )}

              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_28%),linear-gradient(180deg,rgba(6,9,20,0.04),rgba(6,9,20,0.14)_34%,rgba(5,8,22,0.74)_72%,rgba(5,8,22,0.96)_100%)] transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-92 group-focus-visible:opacity-92" />
              <div className="absolute inset-x-0 bottom-0 h-[56%] bg-[linear-gradient(180deg,rgba(5,8,22,0),rgba(5,8,22,0.14)_18%,rgba(5,8,22,0.82)_76%,rgba(5,8,22,0.97)_100%)] opacity-95 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-1 group-hover:opacity-100 group-focus-visible:translate-y-1 group-focus-visible:opacity-100" />
            </div>

            <div className="relative z-10 h-full p-5 sm:p-6">
              <div className="absolute inset-x-5 top-5 flex -translate-y-2 items-start justify-between gap-4 opacity-0 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 sm:inset-x-6 sm:top-6">
                {library.libraryType ? (
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] tracking-[0.18em] text-white/74 uppercase backdrop-blur-md">
                    {library.libraryType}
                  </span>
                ) : (
                  <span />
                )}

                {library.continent?.code ? (
                  <span className="pt-1 text-xs tracking-[0.16em] text-white/56 uppercase">
                    {library.continent.code}
                  </span>
                ) : null}
              </div>

              <div className="absolute inset-x-5 bottom-5 max-w-[22rem] sm:inset-x-6 sm:bottom-6">
                <div className="space-y-2 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2 group-focus-visible:-translate-y-2">
                  <h3 className="max-w-[12ch] text-[clamp(1.8rem,3vw,2.65rem)] leading-[0.96] font-semibold tracking-[-0.05em] text-white">
                    {library.shortName || library.name}
                  </h3>

                  {locationLabel ? (
                    <p className="text-sm text-white/62 sm:text-base">
                      {locationLabel}
                    </p>
                  ) : null}
                </div>

                {library.summary ? (
                  <div className="mt-0 grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity,margin-top] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:mt-4 group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-visible:mt-4 group-focus-visible:grid-rows-[1fr] group-focus-visible:opacity-100">
                    <div className="overflow-hidden">
                      <p className="max-w-[26ch] translate-y-3 text-sm leading-6 text-white/78 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-focus-visible:translate-y-0 sm:text-[15px] sm:leading-7">
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
