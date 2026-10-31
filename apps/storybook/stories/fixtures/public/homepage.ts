import { resolveHomepageContent } from "@/components/home/homepage.content"
import type { HomepageContinentSummary } from "@/components/home/homepage.types"
import type {
  HomepageStats,
  IncompleteLibrary,
  LegalDocumentNavItem,
  PopulatedFeaturedLibraryData,
} from "@/lib/strapi-api/content/server"
import type { Data } from "@repo/strapi-types"

import { libraryFixture } from "../library"
import { journalLanding } from "./articles"
import { driveView } from "./drives"

const dates = {
  createdAt: "2026-01-01T12:00:00Z",
  updatedAt: "2026-01-15T12:00:00Z",
  publishedAt: "2026-01-15T12:00:00Z",
}

export const homepageData: Data.ContentType<"api::homepage.homepage"> = {
  id: 1,
  documentId: "example-homepage",
  ...dates,
}
export const homepageContent = resolveHomepageContent(homepageData)
export const homepageStats: HomepageStats = {
  libraries: 1240,
  countries: 48,
  contributors: 126,
  contributionsThisMonth: 72,
}
export const homepageContinents: HomepageContinentSummary[] = [
  {
    id: 1,
    documentId: "example-europe",
    code: "EU",
    name: "Europe",
    slug: "europe",
    libraryCount: 860,
    countryTotal: 44,
    countries: [
      { name: "Example country", slug: "example-country", libraryCount: 860 },
    ],
  },
  {
    id: 2,
    documentId: "example-africa",
    code: "AF",
    name: "Africa",
    slug: "africa",
    libraryCount: 380,
    countryTotal: 54,
    countries: [],
  },
]
export const featuredLibraries: PopulatedFeaturedLibraryData[] = [
  {
    ...libraryFixture,
    summary: "A welcoming library for the whole community.",
    heroImage: {
      id: 101,
      documentId: "example-library-image",
      ...dates,
      name: "library-placeholder.svg",
      url: "/library-placeholder.svg",
      alternativeText: "Synthetic library illustration",
    },
    continent: {
      id: 1,
      documentId: "example-europe",
      ...dates,
      name: "Europe",
      slug: "europe",
    },
    country: {
      id: 2,
      documentId: "example-country",
      ...dates,
      name: "Example country",
      slug: "example-country",
    },
    region: {
      id: 3,
      documentId: "example-region",
      ...dates,
      name: "Northbridge",
      slug: "northbridge",
    },
  },
]
export const incompleteLibraries: IncompleteLibrary[] = [
  {
    documentId: libraryFixture.documentId,
    slug: libraryFixture.slug!,
    name: libraryFixture.name!,
    place: "Northbridge",
    percent: 65,
    missing: ["hours", "accessibility"],
  },
]
export const homepageTasks = incompleteLibraries.map((item) => ({
  documentId: item.documentId,
  slug: item.slug,
  name: item.name,
  place: item.place,
  missingKey: item.missing[0]!,
}))
export const footerData: Data.ContentType<"api::footer.footer"> = {
  id: 1,
  documentId: "example-footer",
  ...dates,
}
export const legalDocuments: LegalDocumentNavItem[] = [
  {
    documentId: "example-privacy",
    slug: "privacy",
    title: "Privacy",
    navLabel: "Privacy",
    order: 1,
  },
  {
    documentId: "example-terms",
    slug: "terms",
    title: "Terms of use",
    navLabel: "Terms",
    order: 2,
  },
]
export const globeMarkers = [
  {
    lat: 51.5,
    lng: -0.1,
    featured: true,
    name: "Northbridge Community Library",
  },
  { lat: 48.8, lng: 2.3, featured: false, name: "Example reading room" },
]
export const homepageDrives = [driveView]
export const homepageJournal = {
  featured: journalLanding.featured,
  editorsPick: true,
  sideStories: journalLanding.sideStories,
}
export const homepageNetworks = []
export const homepageEvents = []
