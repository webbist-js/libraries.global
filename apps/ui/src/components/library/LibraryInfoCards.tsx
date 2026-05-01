"use client"

import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { T } from "@/lib/design-tokens"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"
import { cn } from "@/lib/styles"

// ── Widget title (rule pattern) ────────────────────────────────────────────────

export function WidgetTitle({
  children,
}: {
  readonly children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        marginBottom: "8px",
      }}
    >
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: T.ink.faint,
          flexShrink: 0,
        }}
      >
        {children}
      </span>
      <div style={{ flex: 1, height: "1px", background: T.border.line }} />
    </div>
  )
}

// ── Fact row ──────────────────────────────────────────────────────────────────

function FactRow({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "155px 1fr",
        alignItems: "baseline",
        gap: "16px",
        paddingTop: "11px",
        paddingBottom: "11px",
        borderBottom: `1px dashed var(--t-border-line)`,
      }}
    >
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "11px",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: T.ink.low,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "14.5px",
          color: T.ink.base,
          lineHeight: 1.4,
        }}
      >
        {children}
      </span>
    </div>
  )
}

// ── Quick link ────────────────────────────────────────────────────────────────

const LINK_ICONS: Record<string, string> = {
  "Search Catalogue": "mdi:magnify",
  "Get a Reader Pass": "mdi:card-account-details-outline",
  "Book a Seat": "mdi:calendar-check-outline",
  "Plan Your Visit": "mdi:map-marker-outline",
  "Virtual Tour": "mdi:rotate-360",
  "Support the Library": "mdi:heart-outline",
}

function ActionLink({
  label,
  href,
}: {
  readonly label: string
  readonly href: string
}) {
  const icon = LINK_ICONS[label] ?? "mdi:arrow-top-right"

  return (
    <GlobalLink
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-(--t-border-line) bg-(--t-bg-surface) px-4 py-3.5 text-[14px] text-(--t-ink-dim) transition-colors hover:border-(--t-border-hi) hover:bg-(--t-bg-deep) hover:text-(--t-ink-base)"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-(--t-border-line) bg-(--t-bg-deep) transition-colors group-hover:border-(--t-aurora-edge) group-hover:bg-(--t-aurora-soft)">
        <Icon
          icon={icon}
          className="size-[16px] text-(--t-accent-aurora) opacity-70 transition-opacity group-hover:opacity-100"
        />
      </span>
      <span className="flex-1">{label}</span>
      <Icon
        icon="mdi:arrow-right"
        className="size-4 shrink-0 text-(--t-ink-ghost) transition-colors group-hover:text-(--t-ink-faint)"
      />
    </GlobalLink>
  )
}

// ── Variants ──────────────────────────────────────────────────────────────────

export function LibraryInfoCards({
  library,
  variant = "overview",
}: {
  readonly library: PopulatedLibraryData
  readonly variant?: "overview" | "contact"
}) {
  const quickLinks = [
    library.catalogueUrl && {
      label: "Search Catalogue",
      href: library.catalogueUrl,
    },
    library.membershipUrl && {
      label: "Get a Reader Pass",
      href: library.membershipUrl,
    },
    library.bookingUrl && { label: "Book a Seat", href: library.bookingUrl },
    library.planVisitUrl && {
      label: "Plan Your Visit",
      href: library.planVisitUrl,
    },
    library.virtualTourUrl && {
      label: "Virtual Tour",
      href: library.virtualTourUrl,
    },
    library.donationUrl && {
      label: "Support the Library",
      href: library.donationUrl,
    },
  ].filter(Boolean) as { label: string; href: string }[]

  const lib = library as Record<string, unknown>

  if (variant === "overview") {
    return (
      <div className={cn(homepagePanelClassName, "p-5 sm:p-6")}>
        <WidgetTitle>About this Library</WidgetTitle>

        <div>
          {library.libraryType ? (
            <FactRow label="Library Type">{library.libraryType}</FactRow>
          ) : null}
          {library.operatorType ? (
            <FactRow label="Operated by">{library.operatorType}</FactRow>
          ) : null}
          {library.foundedYear ? (
            <FactRow label="Founded">
              {library.foundedYear}
              {library.openedYear &&
              library.openedYear !== library.foundedYear ? (
                <span
                  style={{
                    color: T.ink.faint,
                    marginLeft: "6px",
                    fontSize: "13px",
                  }}
                >
                  (building opened {library.openedYear})
                </span>
              ) : (
                ""
              )}
            </FactRow>
          ) : null}
          {lib.architect ? (
            <FactRow label="Architect">{String(lib.architect)}</FactRow>
          ) : null}
          {lib.buildingInfo ? (
            <FactRow label="Building">{String(lib.buildingInfo)}</FactRow>
          ) : null}
          {lib.languagesServed ? (
            <FactRow label="Languages">{String(lib.languagesServed)}</FactRow>
          ) : null}
          {lib.classificationSystem ? (
            <FactRow label="Classification">
              {String(lib.classificationSystem)}
            </FactRow>
          ) : null}
          {lib.iiifEndpoint ? (
            <FactRow label="IIIF Endpoint">
              <GlobalLink
                href={String(lib.iiifEndpoint)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: T.accent.aurora, textDecoration: "none" }}
                className="hover:underline"
              >
                {String(lib.iiifEndpoint).replace(/^https?:\/\//, "")}
              </GlobalLink>
            </FactRow>
          ) : null}
        </div>

        {quickLinks.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-2">
            {quickLinks.map((link) => (
              <ActionLink key={link.href} label={link.label} href={link.href} />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  // variant === "contact"
  const fullAddress = [
    library.streetAddress,
    library.city,
    library.postalCode,
    library.country?.name,
  ]
    .filter(Boolean)
    .join(", ")

  const locationCoords =
    library.location != null &&
    typeof library.location === "object" &&
    !Array.isArray(library.location)
      ? (library.location as { lat?: unknown; lng?: unknown })
      : null
  const mapsUrl =
    locationCoords?.lat != null && locationCoords?.lng != null
      ? `https://www.google.com/maps?q=${locationCoords.lat},${locationCoords.lng}`
      : fullAddress
        ? `https://www.google.com/maps/search/${encodeURIComponent(fullAddress)}`
        : null

  return (
    <div className={cn(homepagePanelClassName, "p-5 sm:p-6")}>
      <WidgetTitle>Location &amp; Contact</WidgetTitle>

      {fullAddress ? (
        <FactRow label="Address">
          {mapsUrl ? (
            <GlobalLink
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-(--t-accent-aurora) hover:underline"
            >
              {fullAddress}
            </GlobalLink>
          ) : (
            fullAddress
          )}
        </FactRow>
      ) : null}

      {library.phone ? (
        <FactRow label="Phone">
          <GlobalLink
            href={`tel:${library.phone}`}
            className="hover:text-(--t-accent-aurora) hover:underline"
          >
            {library.phone}
          </GlobalLink>
        </FactRow>
      ) : null}

      {library.email ? (
        <FactRow label="Email">
          <GlobalLink
            href={`mailto:${library.email}`}
            className="block truncate hover:text-(--t-accent-aurora) hover:underline"
          >
            {library.email}
          </GlobalLink>
        </FactRow>
      ) : null}

      {library.website ? (
        <FactRow label="Website">
          <GlobalLink
            href={library.website}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate hover:text-(--t-accent-aurora) hover:underline"
          >
            {library.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </GlobalLink>
        </FactRow>
      ) : null}
    </div>
  )
}

LibraryInfoCards.displayName = "LibraryInfoCards"

export default LibraryInfoCards
