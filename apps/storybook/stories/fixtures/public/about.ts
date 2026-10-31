import type { CountryBoundaries } from "@/components/about/about-globe-geography"
import type {
  AboutGlobeCountry,
  AboutGlobeRecord,
} from "@/components/about/about-globe.types"
import type { AboutLibrary } from "@/components/about/about.types"

export const aboutLibraries: AboutLibrary[] = [
  {
    documentId: "example-library",
    name: "Northbridge Community Library",
    place: "Northbridge",
    image: "/library-placeholder.svg",
    imageAlt: "Synthetic community-library illustration",
    summary:
      "A welcoming library with reading rooms and local history collections.",
    href: "/libraries/northbridge",
  },
  {
    documentId: "example-mobile",
    name: "Example Mobile Library",
    place: "Eastmere",
    image: "/library-placeholder.svg",
    imageAlt: "Synthetic mobile-library illustration",
    summary: "A travelling collection serving villages and communities.",
    href: "/libraries/mobile",
  },
]
export const aboutCountries: AboutGlobeCountry[] = [
  {
    slug: "united-kingdom",
    name: "United Kingdom",
    iso2: "GB",
    iso3: "GBR",
    continent: "europe",
    libraryCount: 620,
    center: { lat: 54, lng: -2 },
  },
  {
    slug: "france",
    name: "France",
    iso2: "FR",
    iso3: "FRA",
    continent: "europe",
    libraryCount: 240,
    center: { lat: 47, lng: 2 },
  },
]
/** Deliberately coarse synthetic polygons exercise picking without publishing a dataset. */
export const pickingBoundaries: CountryBoundaries = {
  features: [
    {
      properties: { iso3: "GBR" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-8, 50],
            [2, 50],
            [2, 59],
            [-8, 59],
            [-8, 50],
          ],
        ],
      },
    },
    {
      properties: { iso3: "FRA" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-5, 43],
            [8, 43],
            [8, 51],
            [-5, 51],
            [-5, 43],
          ],
        ],
      },
    },
  ],
}

/** Synthetic coverage facts; used when a country is pinned in the explorer. */
export const aboutCountryRecord: AboutGlobeRecord = {
  summary:
    "A synthetic country overview for reviewing the interactive globe card.",
  capitalCity: "Example capital",
  updatedAt: "2026-01-20T12:00:00Z",
  languages: "English, French",
  systemDescription:
    "Public, academic and specialist libraries share an open index.",
  population: {
    count: 1200000,
    year: 2025,
    source: "Synthetic Storybook data",
  },
  regionCoverage: {
    total: 8,
    recorded: 6,
    label: "regions",
    leading: { name: "Northbridge", count: 24, slug: "northbridge" },
  },
  facts: [{ label: "Coverage", value: "6 of 8 regions" }],
  libraryCount: 120,
  libraryTypeCounts: [
    { type: "Public", count: 80 },
    { type: "Academic", count: 40 },
  ],
  featuredLibraries: [
    {
      name: "Northbridge Library",
      place: "Northbridge",
      type: "Public",
      href: "/libraries/northbridge-library",
    },
  ],
}
