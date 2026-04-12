"use client"

import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"
import { cn } from "@/lib/styles"

// NEXT_PUBLIC_MAPBOX_TOKEN — public token, safe to expose in client bundles.
// Restrict it in the Mapbox dashboard to your domain(s).
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCoords(
  library: PopulatedLibraryData
): { lat: number; lng: number } | null {
  const loc = library.location
  if (!loc || typeof loc !== "object" || Array.isArray(loc)) return null
  const { lat, lng } = loc as { lat?: unknown; lng?: unknown }
  if (typeof lat !== "number" || typeof lng !== "number") return null

  return { lat, lng }
}

function buildMapboxStaticUrl(lat: number, lng: number, token: string): string {
  // Indigo-500 (#6366f1) pin matching the site accent colour
  const marker = `pin-l+6366f1(${lng},${lat})`
  const center = `${lng},${lat},14,0`
  // Request tall image; CSS object-cover fills whatever height the container needs
  const size = "800x600@2x"

  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${marker}/${center}/${size}?access_token=${token}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LibraryMap({
  library,
  className,
}: {
  readonly library: PopulatedLibraryData
  readonly className?: string
}) {
  const token = MAPBOX_TOKEN
  const coords = getCoords(library)

  const fullAddress = [
    library.streetAddress,
    library.city,
    library.postalCode,
    library.country?.name,
  ]
    .filter(Boolean)
    .join(", ")

  const googleUrl = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
    : fullAddress
      ? `https://www.google.com/maps/search/${encodeURIComponent(fullAddress)}`
      : null

  const appleUrl = coords
    ? `https://maps.apple.com/?daddr=${coords.lat},${coords.lng}&dirflg=d`
    : fullAddress
      ? `https://maps.apple.com/?q=${encodeURIComponent(fullAddress)}`
      : null

  if (!googleUrl && !appleUrl && (!token || !coords)) return null

  const mapImageUrl =
    token && coords ? buildMapboxStaticUrl(coords.lat, coords.lng, token) : null

  return (
    <div
      className={cn(
        homepagePanelClassName,
        "flex flex-col overflow-hidden",
        className
      )}
    >
      {/* Map image — flex-1 so it grows to fill whatever height the container has */}
      <div className="relative min-h-48 flex-1">
        {mapImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mapImageUrl}
            alt={`Map showing the location of ${library.name}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-white/4">
            <Icon icon="mdi:map-outline" className="size-10 text-white/20" />
          </div>
        )}
      </div>

      {/* Direction links — pinned to bottom, never shrinks */}
      {googleUrl || appleUrl ? (
        <div className="flex shrink-0 flex-wrap gap-2 p-4">
          {googleUrl ? (
            <GlobalLink
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-sm text-white/64 transition-colors hover:border-white/14 hover:bg-white/7 hover:text-white/86"
            >
              <Icon
                icon="mdi:google-maps"
                className="size-4 shrink-0 text-white/46 transition-colors group-hover:text-white/70"
              />
              Google Maps
              <Icon
                icon="mdi:arrow-top-right"
                className="ml-1 size-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-70"
              />
            </GlobalLink>
          ) : null}

          {appleUrl ? (
            <GlobalLink
              href={appleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-sm text-white/64 transition-colors hover:border-white/14 hover:bg-white/7 hover:text-white/86"
            >
              <Icon
                icon="mdi:apple"
                className="size-4 shrink-0 text-white/46 transition-colors group-hover:text-white/70"
              />
              Apple Maps
              <Icon
                icon="mdi:arrow-top-right"
                className="ml-1 size-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-70"
              />
            </GlobalLink>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

LibraryMap.displayName = "LibraryMap"

export default LibraryMap
