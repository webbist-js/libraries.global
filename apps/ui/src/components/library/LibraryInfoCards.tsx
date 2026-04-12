"use client"

import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"
import { cn } from "@/lib/styles"

function InfoRow({
  icon,
  label,
  children,
}: {
  readonly icon: string
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/6">
        <Icon icon={icon} className="size-4 text-white/60" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] tracking-[0.12em] text-white/38 uppercase">
          {label}
        </p>
        <div className="mt-0.5 text-sm text-white/86">{children}</div>
      </div>
    </div>
  )
}

function QuickLink({
  icon,
  label,
  href,
}: {
  readonly icon: string
  readonly label: string
  readonly href: string
}) {
  return (
    <GlobalLink
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-sm text-white/64 transition-colors hover:border-white/14 hover:bg-white/7 hover:text-white/86"
    >
      <Icon
        icon={icon}
        className="size-4 shrink-0 text-white/46 transition-colors group-hover:text-white/70"
      />
      <span className="truncate">{label}</span>
      <Icon
        icon="mdi:arrow-top-right"
        className="ml-auto size-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-70"
      />
    </GlobalLink>
  )
}

// variant="overview" — classification only (type, operator, founded). Used in Overview tab.
// variant="contact"  — address, phone, email, website + external links. Used in Contact tab.
export function LibraryInfoCards({
  library,
  variant = "overview",
}: {
  readonly library: PopulatedLibraryData
  readonly variant?: "overview" | "contact"
}) {
  const quickLinks = [
    library.catalogueUrl && {
      icon: "mdi:book-search-outline",
      label: "Search Catalogue",
      href: library.catalogueUrl,
    },
    library.membershipUrl && {
      icon: "mdi:card-account-details-outline",
      label: "Get a Reader Pass",
      href: library.membershipUrl,
    },
    library.bookingUrl && {
      icon: "mdi:calendar-check-outline",
      label: "Book a Seat",
      href: library.bookingUrl,
    },
    library.planVisitUrl && {
      icon: "mdi:map-outline",
      label: "Plan Your Visit",
      href: library.planVisitUrl,
    },
    library.virtualTourUrl && {
      icon: "mdi:rotate-360",
      label: "Virtual Tour",
      href: library.virtualTourUrl,
    },
    library.donationUrl && {
      icon: "mdi:heart-outline",
      label: "Support the Library",
      href: library.donationUrl,
    },
  ].filter(Boolean) as { icon: string; label: string; href: string }[]

  if (variant === "overview") {
    return (
      <div className={cn(homepagePanelClassName, "space-y-4 p-5 sm:p-6")}>
        <h2 className="text-[11px] font-medium tracking-[0.18em] text-white/40 uppercase">
          About this Library
        </h2>

        <div className="space-y-4">
          {library.libraryType ? (
            <InfoRow icon="mdi:library-outline" label="Library Type">
              {library.libraryType}
            </InfoRow>
          ) : null}

          {library.operatorType ? (
            <InfoRow icon="mdi:domain" label="Operated by">
              {library.operatorType}
            </InfoRow>
          ) : null}

          {library.foundedYear ? (
            <InfoRow icon="mdi:calendar-outline" label="Founded">
              {library.foundedYear}
              {library.openedYear && library.openedYear !== library.foundedYear
                ? ` (opened ${library.openedYear})`
                : ""}
            </InfoRow>
          ) : null}
        </div>

        {quickLinks.length > 0 ? (
          <div className="space-y-2 border-t border-white/8 pt-4">
            {quickLinks.map((link) => (
              <QuickLink key={link.href} {...link} />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  // variant === "contact"
  // (quickLinks already computed above)
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
    <div className="space-y-4">
      <div className={cn(homepagePanelClassName, "space-y-4 p-5 sm:p-6")}>
        <h2 className="text-[11px] font-medium tracking-[0.18em] text-white/40 uppercase">
          Location &amp; Contact
        </h2>

        <div className="space-y-4">
          {fullAddress ? (
            <InfoRow icon="mdi:map-marker-outline" label="Address">
              {mapsUrl ? (
                <GlobalLink
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white hover:underline"
                >
                  {fullAddress}
                </GlobalLink>
              ) : (
                fullAddress
              )}
            </InfoRow>
          ) : null}

          {library.phone ? (
            <InfoRow icon="mdi:phone-outline" label="Phone">
              <GlobalLink
                href={`tel:${library.phone}`}
                className="hover:text-white hover:underline"
              >
                {library.phone}
              </GlobalLink>
            </InfoRow>
          ) : null}

          {library.email ? (
            <InfoRow icon="mdi:email-outline" label="Email">
              <GlobalLink
                href={`mailto:${library.email}`}
                className="block truncate hover:text-white hover:underline"
              >
                {library.email}
              </GlobalLink>
            </InfoRow>
          ) : null}

          {library.website ? (
            <InfoRow icon="mdi:web" label="Website">
              <GlobalLink
                href={library.website}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate hover:text-white hover:underline"
              >
                {library.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </GlobalLink>
            </InfoRow>
          ) : null}
        </div>
      </div>
    </div>
  )
}

LibraryInfoCards.displayName = "LibraryInfoCards"

export default LibraryInfoCards
