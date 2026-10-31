import type {
  PopulatedContinentData,
  PopulatedCountryData,
  PopulatedRegionData,
  RegionLibrary,
} from "@/lib/strapi-api/content/server"

import { libraryFixture } from "../library"
import { weeklyHours } from "../opening-times"

const dates = {
  createdAt: "2026-01-01T12:00:00Z",
  updatedAt: "2026-01-15T12:00:00Z",
  publishedAt: "2026-01-15T12:00:00Z",
  locale: "en",
}

export const regionLibraries: RegionLibrary[] = [
  {
    documentId: "example-library",
    name: "Northbridge Community Library",
    slug: "northbridge-library",
    libraryType: "Public",
    city: "Northbridge",
    summary: "A welcoming library with accessible reading rooms.",
    openingTimes: weeklyHours,
    timezone: "Europe/London",
    location: { lat: 51.5, lng: -0.1 },
    website: "https://example.invalid/library",
    operationalStatus: "open",
    heroImage: { url: "/library-placeholder.svg" },
  },
  {
    documentId: "example-archive",
    name: "Northbridge Local History Archive",
    slug: "northbridge-archive",
    libraryType: "Archive",
    city: "Northbridge",
    summary: "Explore the district’s shared history.",
    location: { lat: 51.53, lng: -0.06 },
    operationalStatus: "open",
  },
]
export const continentFixture: PopulatedContinentData = {
  ...dates,
  id: 1,
  documentId: "example-continent",
  name: "Example continent",
  slug: "example-continent",
  code: "EX",
  libraryCount: 24,
  countries: [
    {
      documentId: "example-country",
      name: "Example country",
      slug: "example-country",
      libraryCount: 24,
      center: { lat: 51.5, lng: -0.1 },
    },
  ],
  featuredLibraries: [libraryFixture],
}
export const countryFixture: PopulatedCountryData = {
  ...dates,
  id: 2,
  documentId: "example-country",
  name: "Example country",
  slug: "example-country",
  iso2: "EX",
  libraryCount: 24,
  continent: {
    id: 1,
    documentId: "example-continent",
    name: "Example continent",
    slug: "example-continent",
  },
  regions: [
    {
      documentId: "example-region",
      name: "Northbridge",
      slug: "northbridge",
      libraryCount: 24,
      center: { lat: 51.5, lng: -0.1 },
    },
  ],
  featuredLibraries: [libraryFixture],
}
export const regionFixture: PopulatedRegionData = {
  ...dates,
  id: 3,
  documentId: "example-region",
  name: "Northbridge",
  slug: "northbridge",
  libraryCount: 24,
  libraryTypeCounts: [
    { type: "Public", count: 18 },
    { type: "Archive", count: 6 },
  ],
  center: { lat: 51.5, lng: -0.1 },
  continent: {
    id: 1,
    documentId: "example-continent",
    name: "Example continent",
    slug: "example-continent",
  },
  country: {
    id: 2,
    documentId: "example-country",
    name: "Example country",
    slug: "example-country",
    continent: {
      id: 1,
      documentId: "example-continent",
      name: "Example continent",
      slug: "example-continent",
    },
  },
  libraries: regionLibraries,
  siblings: [
    {
      name: "Eastmere",
      slug: "eastmere",
      libraryCount: 12,
      center: { lat: 51.6, lng: 0 },
    },
  ],
  areas: [
    {
      documentId: "example-area",
      name: "Market district",
      slug: "market-district",
      libraryCount: 6,
    },
  ],
}
