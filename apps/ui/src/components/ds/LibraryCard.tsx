import Image from "next/image"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

// ── Type-based gradient fallbacks ─────────────────────────────────────────────

const TYPE_GRADIENT: Record<string, string> = {
  National: "linear-gradient(135deg, #0a1a2d 0%, #0d0d2e 100%)",
  Public: "linear-gradient(135deg, #0a1f1a 0%, #071428 100%)",
  Academic: "linear-gradient(135deg, #1a1a0d 0%, #0d1a2e 100%)",
  University: "linear-gradient(135deg, #1a1a0d 0%, #0d1a2e 100%)",
  Parliamentary: "linear-gradient(135deg, #1a0a0d 0%, #0d0a1a 100%)",
  Monastic: "linear-gradient(135deg, #1a0a2d 0%, #2d1a0a 100%)",
  Archive: "linear-gradient(135deg, #1a100a 0%, #0d1a1a 100%)",
}

function typeGradient(type?: string | null): string {
  return (
    TYPE_GRADIENT[type ?? ""] ??
    "linear-gradient(135deg, #0a0d1a 0%, #0d0a2e 100%)"
  )
}

function padIndex(n: number) {
  return String(n + 1).padStart(2, "0")
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface LibraryCardProps {
  documentId: string
  slug?: string | null
  name: string
  shortName?: string | null
  libraryType?: string | null
  city?: string | null
  countryName?: string | null
  continentCode?: string | null
  foundedYear?: string | null
  heroImageUrl?: string | null
  heroImageAlt?: string | null
  href?: string | null
  /** Zero-based index for the card number badge. */
  index?: number
  /**
   * featured — tall cinematic card (homepage style, ~460px).
   * compact  — smaller grid card (~220px).
   */
  variant?: "featured" | "compact"
}

// ── Shared inner content ───────────────────────────────────────────────────────

function CardInner({
  name,
  shortName,
  libraryType,
  city,
  countryName,
  continentCode,
  foundedYear,
  heroImageUrl,
  heroImageAlt,
  index,
  isCompact,
}: Omit<LibraryCardProps, "documentId" | "slug" | "href" | "variant"> & {
  isCompact: boolean
}) {
  const locationParts = [
    city,
    countryName,
    libraryType,
    foundedYear ? `Est. ${foundedYear}` : null,
  ].filter(Boolean)

  const displayName = isCompact ? name : shortName || name

  return (
    <>
      {/* Background image */}
      <div className="absolute inset-0">
        {heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt={heroImageAlt ?? name}
            fill
            className="lib-card-img object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(60,100,200,0.12),transparent_50%)]" />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "var(--lib-card-overlay)" }}
        />
      </div>

      {/* Index badge — top left */}
      {index != null && (
        <div className="absolute top-4 left-4 flex size-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] font-mono text-[10px] text-white/50 backdrop-blur-sm">
          {padIndex(index)}
        </div>
      )}

      {/* Continent code / type chip — top right */}
      {!isCompact && continentCode ? (
        <div className="absolute top-4 right-4 font-mono text-[10px] tracking-[0.08em] text-white/30 uppercase">
          {continentCode}
        </div>
      ) : libraryType ? (
        <div
          className="absolute top-4 right-4 rounded px-2 py-0.5 font-mono text-[10px] tracking-[0.10em] text-white/70 uppercase backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          {libraryType}
        </div>
      ) : null}

      {/* Bottom content */}
      <div
        className={`absolute inset-x-0 bottom-0 ${isCompact ? "p-4" : "p-5 sm:p-6"}`}
      >
        {!isCompact && <div className="mb-4 h-px bg-white/10" />}

        <h3
          className={`leading-[1.05] font-semibold tracking-[-0.02em] text-white ${
            isCompact ? "mb-1 text-[1.15rem]" : "mb-2 text-[1.9rem]"
          }`}
          style={{
            fontFamily: T.font.serif,
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          {displayName}
        </h3>

        {!isCompact && locationParts.length > 0 && (
          <p className="text-[11px] tracking-[0.08em] text-white/45 uppercase">
            {locationParts.join(" · ")}
          </p>
        )}

        {isCompact && (city || countryName) && (
          <p
            className="truncate text-[10px] tracking-[0.08em] text-white/40 uppercase"
            style={{ fontFamily: T.font.mono }}
          >
            {[city, countryName].filter(Boolean).join(", ")}
          </p>
        )}
      </div>
    </>
  )
}

// ── Exported component ─────────────────────────────────────────────────────────

export function LibraryCard({
  documentId,
  slug,
  name,
  shortName,
  libraryType,
  city,
  countryName,
  continentCode,
  foundedYear,
  heroImageUrl,
  heroImageAlt,
  href,
  index,
  variant = "featured",
}: LibraryCardProps) {
  const isCompact = variant === "compact"

  const sharedInnerProps = {
    name,
    shortName,
    libraryType,
    city,
    countryName,
    continentCode,
    foundedYear,
    heroImageUrl,
    heroImageAlt,
    index,
    isCompact,
  }

  if (isCompact) {
    const inner = (
      <div
        className="group relative overflow-hidden rounded-xl border transition-all duration-300 hover:brightness-110"
        style={{
          background: typeGradient(libraryType),
          borderColor: "var(--lib-card-border)",
          height: "220px",
        }}
      >
        <CardInner {...sharedInnerProps} />
      </div>
    )

    if (!href) return inner

    return (
      <a href={href} style={{ textDecoration: "none", display: "block" }}>
        {inner}
      </a>
    )
  }

  // Featured variant — GlobalLink IS the card container
  // Border is always the dark-mode white separator since the card is always dark
  return (
    <GlobalLink
      key={documentId ?? slug ?? index}
      href={href}
      fallbackAs="div"
      className="group relative h-[460px] w-[78vw] min-w-[260px] flex-none snap-start overflow-hidden border-r transition-all duration-700 last:border-r-0 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none sm:h-[500px] sm:w-[42vw] lg:w-[28vw] xl:w-[26vw]"
      style={{
        background: typeGradient(libraryType),
        borderColor: "var(--lib-card-border)",
      }}
    >
      <CardInner {...sharedInnerProps} />
    </GlobalLink>
  )
}

LibraryCard.displayName = "LibraryCard"
