import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
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

  if (!href) return null

  return (
    <GlobalLink
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${T.border.line}`,
        borderRadius: "16px",
        overflow: "hidden",
        background: "rgba(255,255,255,.015)",
        transition: "background 250ms",
        textDecoration: "none",
      }}
      className="group hover:bg-[rgba(127,223,255,.03)]"
    >
      {/* Thumbnail */}
      <div
        style={{
          height: "140px",
          background: imageUrl
            ? `url(${imageUrl}) center/cover no-repeat`
            : "linear-gradient(135deg,rgba(8,12,30,1),rgba(20,28,60,1))",
          flexShrink: 0,
        }}
      />

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
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          {[library.libraryType, library.city].filter(Boolean).join(" · ")}
        </div>
        <h3
          style={{
            fontFamily: T.font.serif,
            fontWeight: 400,
            fontSize: "17px",
            color: T.ink.base,
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {library.name}
        </h3>
        {library.summary ? (
          <p
            style={{
              fontSize: "13px",
              color: T.ink.low,
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
              fontSize: "12px",
              color: T.accent.aurora,
              opacity: 0.7,
              transition: "opacity 200ms",
            }}
            className="group-hover:opacity-100"
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
  // TODO: fetch real nearby data — currently populated by server via fetchNearbyLibraries
  if (!libraries.length) return null

  return (
    <section style={{ paddingTop: "40px", paddingBottom: "40px" }}>
      <div
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: T.ink.faint,
          marginBottom: "6px",
        }}
      >
        Explore Nearby
      </div>
      <h2
        style={{
          fontFamily: T.font.serif,
          fontWeight: 400,
          fontSize: "26px",
          color: T.ink.base,
          margin: "0 0 24px",
        }}
      >
        Other libraries{regionName ? ` in ${regionName}` : " nearby"}
      </h2>

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
