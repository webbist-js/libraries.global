import type { LibraryTypeCount } from "@/lib/strapi-api/content/server"

export type AboutGlobeCountry = {
  slug: string
  name: string
  iso2: string | null
  iso3: string
  continent: string
  libraryCount: number | null
  center: { lat: number; lng: number } | null
}

export type AboutGlobeRecord = {
  summary: string | null
  capitalCity: string | null
  libraryCount: number | null
  libraryTypeCounts: LibraryTypeCount[] | null
  featuredLibraries: {
    name: string
    place: string
    type: string | null
    href: string | null
  }[]
}

export type GlobeHover =
  | { kind: "country"; country: AboutGlobeCountry; lat: number; lng: number }
  | { kind: "connection"; index: number; names: readonly [string, string] }
  | null
