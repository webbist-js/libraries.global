import { LibraryCard } from "@/components/ds/LibraryCard"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import type { FollowedLibrary } from "@/lib/types/profile"

// ── FollowedLibrariesGrid ────────────────────────────────────────────────────
//
// variant="compact"  — 2-3 col grid, up to `max` cards. Used in OverviewSection.
// variant="carousel" — full horizontal scroll. Used in FollowingSection.

export function FollowedLibrariesGrid({
  libraries,
  username,
  variant = "compact",
  max,
}: {
  libraries: FollowedLibrary[]
  username: string
  variant?: "compact" | "carousel"
  max?: number
}) {
  const items = max ? libraries.slice(0, max) : libraries

  if (libraries.length === 0) {
    return (
      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "10px",
          padding: "28px",
          textAlign: "center",
          background: T.bg.surface,
        }}
      >
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.faint,
            margin: 0,
          }}
        >
          No libraries followed yet
        </p>
      </div>
    )
  }

  if (variant === "carousel") {
    return (
      <div className="flex snap-x snap-mandatory gap-px overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden">
        {items.map((lib, index) => (
          <LibraryCard
            key={lib.documentId ?? lib.slug ?? lib.name}
            documentId={lib.documentId ?? lib.slug ?? lib.name}
            slug={lib.slug}
            name={lib.name ?? ""}
            libraryType={lib.libraryType}
            heroImageUrl={formatStrapiMediaUrl(lib.heroImageUrl) ?? null}
            href={lib.slug ? `/library/${lib.slug}` : null}
            index={index}
            variant="featured"
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {items.map((lib, index) => (
          <LibraryCard
            key={lib.documentId ?? lib.slug ?? String(index)}
            documentId={lib.documentId ?? lib.slug ?? String(index)}
            slug={lib.slug}
            name={lib.name ?? ""}
            libraryType={lib.libraryType}
            heroImageUrl={formatStrapiMediaUrl(lib.heroImageUrl) ?? null}
            href={lib.slug ? `/library/${lib.slug}` : null}
            index={index}
            variant="compact"
          />
        ))}
      </div>
      {max && libraries.length > max && (
        <div style={{ marginTop: "12px", textAlign: "right" }}>
          <Link
            href={`/profile/${username}/following`}
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.accent.aurora,
              textDecoration: "none",
              opacity: 0.8,
            }}
          >
            See all {libraries.length} →
          </Link>
        </div>
      )}
    </div>
  )
}
