// ── Map shared types ──────────────────────────────────────────────────────────

export interface LibraryMapPin {
  documentId: string
  name: string
  slug: string
  libraryType?: string | null
  operationalStatus?: string | null
  city?: string | null
  summary?: string | null
  /** Raw hero image URL from Strapi (may be /uploads/... or https://...) */
  heroImage?: { url?: string | null } | null
  /** Flattened hero image URL — populated after GeoJSON round-trip on pin click */
  heroImageUrl?: string | null
  location: { lat: number; lng: number }
  continent?: { slug: string } | null
  country?: { slug: string } | null
  region?: { slug: string } | null
}

export interface GeoMapPin {
  documentId: string
  name: string
  slug: string
  /** Centroid — optional when boundaryUrl is present */
  lat?: number | null
  lng?: number | null
  boundingBoxNE?: string | null
  boundingBoxSW?: string | null
  /** URL to a static GeoJSON file in public/boundaries/ */
  boundaryUrl?: string | null
  continent?: { slug: string } | null
  country?: { slug: string } | null
  region?: { slug: string } | null
}

export type MapDrillLevel = "continent" | "country" | "region" | "area"

export interface BreadcrumbEntry {
  label: string
  level: MapDrillLevel
  areaSlug?: string
  regionSlug?: string
  countrySlug?: string
  continentSlug?: string
  /** Bounding box of the level being entered — used to re-fit viewport on back */
  boundingBoxNE?: string | null
  boundingBoxSW?: string | null
}

export interface LibraryDetails {
  foundedYear?: string | null
  district?: string | null
  featured?: boolean | null
  openingTimes?: unknown
  countryName?: string | null
  regionName?: string | null
}
