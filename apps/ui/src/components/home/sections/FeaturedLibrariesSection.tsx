import Image from "next/image"

import GlobalLink from "@/components/global/GlobalLink"
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

function TypeBadge({ libraryType }: { libraryType?: string | null }) {
  if (!libraryType) return null
  const tint = tintForLibraryType(libraryType)

  return (
    <span
      className="self-start rounded-full px-2.5 py-1 text-[14px] font-semibold"
      style={{ background: tint.bg, color: tint.fg }}
    >
      {libraryType} library
    </span>
  )
}

function CardImage({
  library,
  className,
  inset,
  radius,
}: {
  library: PopulatedFeaturedLibraryData
  className?: string
  inset: string
  radius: number
}) {
  const url = formatStrapiMediaUrl(library.heroImage?.url)
  const tint = tintForLibraryType(library.libraryType)
  const monogram = (library.name ?? "?").trim().charAt(0).toUpperCase()

  return (
    <div className={className}>
      <div
        className="absolute overflow-hidden"
        style={{ inset, borderRadius: radius }}
      >
        {url ? (
          <Image
            src={url}
            alt={library.heroImage?.alternativeText ?? library.name ?? ""}
            fill
            className="object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: tint.bg }}
          >
            <span
              aria-hidden="true"
              style={{
                fontFamily: T.font.serif,
                fontSize: 64,
                fontWeight: 500,
                color: tint.fg,
              }}
            >
              {monogram}
            </span>
            <span
              className="absolute bottom-3 left-3 rounded-full bg-white/85 px-2.5 py-1 text-[13px] font-medium"
              style={{ color: T.ink.dim }}
            >
              No photo yet
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function FeaturedLibrariesSection({
  libraries,
}: {
  readonly libraries?: PopulatedFeaturedLibraryData[] | null
}) {
  if (!Array.isArray(libraries) || libraries.length === 0) return null

  const [featured, ...rest] = libraries
  const standard = rest.slice(0, 2)

  return (
    <section
      id="featured"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8"
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            className="m-0"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(34px,4vw,50px)",
              letterSpacing: "-0.015em",
              color: T.ink.base,
            }}
          >
            Libraries worth knowing
          </h2>
          <p
            className="mt-2 max-w-[560px] text-[18px] leading-[1.5]"
            style={{ color: T.ink.dim }}
          >
            Remarkable buildings, collections and histories from across the
            index.
          </p>
        </div>
        <GlobalLink
          href="/index"
          className="font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          Browse all libraries
        </GlobalLink>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5">
        {featured ? (
          <article
            className="col-span-full grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] overflow-hidden rounded-[28px] border bg-white"
            style={{ borderColor: T.border.line }}
          >
            <CardImage
              library={featured}
              className="relative min-h-[340px]"
              inset="10px"
              radius={20}
            />
            <div className="flex flex-col justify-center gap-3.5 p-[clamp(24px,4vw,44px)]">
              <div className="flex flex-wrap gap-2">
                <TypeBadge libraryType={featured.libraryType} />
                {locationLabel(featured) ? (
                  <span
                    className="rounded-full px-2.5 py-1 text-[14px] font-medium"
                    style={{ background: T.bg.muted, color: T.ink.base }}
                  >
                    {locationLabel(featured)}
                  </span>
                ) : null}
              </div>
              <h3
                className="m-0"
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 500,
                  fontSize: "clamp(32px,3.4vw,44px)",
                  lineHeight: 1.05,
                  color: T.ink.base,
                }}
              >
                {featured.name}
              </h3>
              {featured.summary ? (
                <p
                  className="m-0 line-clamp-4 text-[18px] leading-[1.6] text-pretty"
                  style={{ color: T.ink.dim }}
                >
                  {featured.summary}
                </p>
              ) : null}
              <GlobalLink
                href={libraryHref(featured)}
                className="text-[17px] font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                Read the record
              </GlobalLink>
            </div>
          </article>
        ) : null}

        {standard.map((library) => (
          <article
            key={library.documentId}
            className="flex flex-col overflow-hidden rounded-[24px] border bg-white"
            style={{ borderColor: T.border.line }}
          >
            <CardImage
              library={library}
              className="relative h-[220px]"
              inset="8px 8px 0"
              radius={16}
            />
            <div className="flex flex-col gap-2.5 p-[20px_22px_24px]">
              <TypeBadge libraryType={library.libraryType} />
              <h3
                className="m-0 text-[28px]"
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 500,
                  color: T.ink.base,
                }}
              >
                {library.name}
              </h3>
              <p
                className="m-0 line-clamp-3 text-[16px] leading-[1.55]"
                style={{ color: T.ink.dim }}
              >
                {[locationLabel(library), library.summary]
                  .filter(Boolean)
                  .join(". ")}
              </p>
              <GlobalLink
                href={libraryHref(library)}
                className="font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                Read the record
              </GlobalLink>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

FeaturedLibrariesSection.displayName = "FeaturedLibrariesSection"

export default FeaturedLibrariesSection
