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
  updatedAt: string | null
  languages: string | null
  systemDescription: string | null
  population: {
    count: number
    year: number | null
    source: string | null
  } | null
  regionCoverage: {
    total: number
    recorded: number
    label: string
    leading: { name: string; count: number; slug: string } | null
  } | null
  facts: { label: string; value: string }[]
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
