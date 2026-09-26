import GlobalLink from "@/components/global/GlobalLink"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

type NearbyLibrary = Pick<
  PopulatedLibraryData,
  | "name"
  | "slug"
  | "summary"
  | "libraryType"
  | "city"
  | "operationalStatus"
  | "heroImage"
  | "continent"
  | "country"
  | "region"
>

function NearbyCard({ library }: { readonly library: NearbyLibrary }) {
  const continentSlug = library.continent?.slug
  const countrySlug = library.country?.slug
  const regionSlug = library.region?.slug
  const href =
    continentSlug && countrySlug && regionSlug && library.slug
      ? `/${continentSlug}/${countrySlug}/${regionSlug}/${library.slug}`
      : null

  const imageUrl = formatStrapiMediaUrl(library.heroImage?.url)
  const tint = tintForLibraryType(library.libraryType)

  if (!href) return null

  return (
    <GlobalLink
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${T.border.line}`,
        borderRadius: "20px",
        overflow: "hidden",
        background: T.bg.deep,
        transition: "border-color 200ms, box-shadow 200ms",
        textDecoration: "none",
      }}
      className="group hover:border-[#B9B4F5] hover:shadow-[0_12px_28px_rgba(23,22,43,0.08)]"
    >
      {/* Thumbnail — photo or type-tinted monogram */}
      {imageUrl ? (
        <div
          style={{
            height: "140px",
            background: `url(${imageUrl}) center/cover no-repeat`,
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            height: "140px",
            background: tint.bg,
            color: tint.fg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: T.font.serif,
            fontSize: "44px",
            flexShrink: 0,
          }}
        >
          {(library.name ?? "?").charAt(0)}
        </div>
      )}

      {/* Content */}
      <div
        style={{
          padding: "16px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <h3
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            fontSize: "20px",
            color: T.ink.base,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {library.name}
        </h3>
        <div style={{ fontSize: "14px", color: T.ink.dim }}>
          {[library.libraryType, library.city].filter(Boolean).join(" · ")}
        </div>
        {library.summary ? (
          <p
            style={{
              fontSize: "14px",
              color: T.ink.dim,
              margin: 0,
              lineHeight: 1.55,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {library.summary}
          </p>
        ) : null}
        <div style={{ marginTop: "auto", paddingTop: "8px" }}>
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: T.accent.primary,
            }}
          >
            View library →
          </span>
        </div>
      </div>
    </GlobalLink>
  )
}

export function LibraryExploreNearby({
  libraries,
  regionName,
}: {
  readonly libraries: NearbyLibrary[]
  readonly regionName?: string | null
}) {
  if (!libraries.length) return null

  return (
    <section>
      <p
        style={{
          fontSize: "16px",
          color: T.ink.dim,
          margin: "0 0 16px",
        }}
      >
        Other libraries{regionName ? ` in ${regionName}` : " nearby"}.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        {libraries.map((lib) => (
          <NearbyCard key={lib.slug} library={lib} />
        ))}
      </div>
    </section>
  )
}

LibraryExploreNearby.displayName = "LibraryExploreNearby"

export default LibraryExploreNearby
