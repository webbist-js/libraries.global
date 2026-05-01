"use client"

import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { T } from "@/lib/design-tokens"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"
import { cn } from "@/lib/styles"

// ── Map helpers (same as LibraryMap) ─────────────────────────────────────────

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

function getCoords(
  library: PopulatedLibraryData
): { lat: number; lng: number } | null {
  const loc = library.location
  if (!loc || typeof loc !== "object" || Array.isArray(loc)) return null
  const { lat, lng } = loc as { lat?: unknown; lng?: unknown }
  if (typeof lat !== "number" || typeof lng !== "number") return null

  return { lat, lng }
}

function buildMapUrl(lat: number, lng: number, token: string): string {
  const marker = `pin-l+7fdfff(${lng},${lat})`
  const center = `${lng},${lat},14,0`

  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${marker}/${center}/800x360@2x?access_token=${token}`
}

// ── Info card ─────────────────────────────────────────────────────────────────

function InfoCard({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "14px",
        background: T.bg.surface,
        padding: "16px",
      }}
    >
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".16em",
          textTransform: "uppercase",
          color: T.ink.low,
          marginBottom: "10px",
        }}
      >
        {label}
      </p>
      <div
        style={{
          fontSize: "15px",
          color: T.ink.base,
          lineHeight: 1.5,
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LibraryContactPanel({
  library,
}: {
  readonly library: PopulatedLibraryData
}) {
  const coords = getCoords(library)
  const mapImageUrl =
    MAPBOX_TOKEN && coords
      ? buildMapUrl(coords.lat, coords.lng, MAPBOX_TOKEN)
      : null

  const fullAddress = [library.streetAddress, library.city, library.postalCode]
    .filter(Boolean)
    .join("\n")

  const countryName = library.country?.name
  const fullAddressWithCountry = [
    library.streetAddress,
    [library.city, library.postalCode].filter(Boolean).join(" "),
    countryName,
  ]
    .filter(Boolean)
    .join("\n")

  const googleUrl = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
    : fullAddress
      ? `https://www.google.com/maps/search/${encodeURIComponent(fullAddress)}`
      : null

  const transitInfo = (library as Record<string, unknown>).transitInfo as
    | string
    | null
    | undefined

  const hasAny =
    fullAddressWithCountry ||
    coords ||
    library.phone ||
    library.email ||
    library.website

  if (!hasAny) return null

  // Build the card list (only cards with values)
  const cards: { label: string; content: React.ReactNode }[] = []

  if (fullAddressWithCountry) {
    cards.push({
      label: "Address",
      content: googleUrl ? (
        <GlobalLink
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: T.ink.base, textDecoration: "none" }}
          className="hover:text-(--t-accent-aurora)"
        >
          {fullAddressWithCountry.split("\n").map((line, i) => (
            <span key={i} style={{ display: "block" }}>
              {line}
            </span>
          ))}
        </GlobalLink>
      ) : (
        fullAddressWithCountry.split("\n").map((line, i) => (
          <span key={i} style={{ display: "block" }}>
            {line}
          </span>
        ))
      ),
    })
  }

  if (coords) {
    cards.push({
      label: "Coordinates",
      content: (
        <>
          <span style={{ display: "block" }}>
            {Math.abs(coords.lat).toFixed(4)}° {coords.lat >= 0 ? "N" : "S"}
          </span>
          <span style={{ display: "block" }}>
            {Math.abs(coords.lng).toFixed(4)}° {coords.lng >= 0 ? "E" : "W"}
          </span>
        </>
      ),
    })
  }

  if (library.phone) {
    cards.push({
      label: "Phone",
      content: (
        <GlobalLink
          href={`tel:${library.phone}`}
          style={{ color: T.ink.base, textDecoration: "none" }}
          className="hover:text-(--t-accent-aurora) hover:underline"
        >
          {library.phone}
        </GlobalLink>
      ),
    })
  }

  if (library.email) {
    cards.push({
      label: "Email",
      content: (
        <GlobalLink
          href={`mailto:${library.email}`}
          style={{
            color: T.ink.base,
            textDecoration: "none",
            wordBreak: "break-all",
          }}
          className="hover:text-(--t-accent-aurora) hover:underline"
        >
          {library.email}
        </GlobalLink>
      ),
    })
  }

  if (library.website) {
    const domain = library.website
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
    cards.push({
      label: "Website",
      content: (
        <GlobalLink
          href={library.website}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: T.ink.base, textDecoration: "none" }}
          className="hover:text-(--t-accent-aurora)"
        >
          {domain} →
        </GlobalLink>
      ),
    })
  }

  if (transitInfo) {
    cards.push({
      label: "Transit",
      content: transitInfo.split("\n").map((line, i) => (
        <span key={i} style={{ display: "block" }}>
          {line}
        </span>
      )),
    })
  }

  return (
    <div className={cn(homepagePanelClassName, "overflow-hidden p-0")}>
      {/* Title */}
      <div style={{ padding: "20px 20px 16px" }}>
        <h2
          style={{
            fontFamily: T.font.serif,
            fontWeight: 400,
            fontSize: "26px",
            color: T.ink.base,
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          Contact &amp; location
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".16em",
              color: T.accent.aurora,
              textTransform: "uppercase",
              border: `1px solid var(--t-aurora-edge)`,
              borderRadius: "6px",
              padding: "3px 8px",
            }}
          >
            § Address
          </span>
        </h2>
      </div>

      {/* Card grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          padding: "0 20px 16px",
        }}
      >
        {cards.map((card) => (
          <InfoCard key={card.label} label={card.label}>
            {card.content}
          </InfoCard>
        ))}
      </div>

      {/* Map */}
      {(mapImageUrl ?? googleUrl) ? (
        <div>
          {/* Map image */}
          <div
            style={{
              position: "relative",
              height: "200px",
              overflow: "hidden",
              borderTop: `1px solid ${T.border.line}`,
            }}
          >
            {mapImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mapImageUrl}
                alt={`Map showing location of ${library.name}`}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: T.bg.surface,
                }}
              >
                <Icon
                  icon="mdi:map-outline"
                  className="size-10 text-(--t-ink-ghost)"
                />
              </div>
            )}
          </div>

          {/* Map footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 20px",
              borderTop: `1px solid ${T.border.line}`,
            }}
          >
            <span
              style={{
                fontSize: "13px",
                color: T.ink.low,
              }}
            >
              {[library.streetAddress, library.city]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {googleUrl ? (
              <GlobalLink
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: T.accent.aurora,
                  textDecoration: "none",
                }}
                className="hover:underline"
              >
                Open in map →
              </GlobalLink>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

LibraryContactPanel.displayName = "LibraryContactPanel"

export default LibraryContactPanel
