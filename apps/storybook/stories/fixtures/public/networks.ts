import type {
  NetworkDetail,
  NetworkList,
  NetworkWorkspace,
} from "@/lib/networks/types"
import type {
  NetworkSummary,
  NetworkMandate,
  NetworkAffiliation,
  WidgetLibrary,
} from "@repo/shared-data"

export const network: NetworkSummary = {
  documentId: "example-network",
  name: "Northbridge Library Service",
  slug: "northbridge-library-service",
  kind: "library_service",
  description:
    "A public library service connecting reading rooms, local collections and mobile services.",
  website: "https://example.invalid/service",
  sourceUrl: "https://example.invalid/service/branches",
  lastVerifiedAt: "2026-01-15T12:00:00Z",
  countries: [
    {
      documentId: "example-country",
      name: "Example country",
      slug: "example-country",
      continentSlug: "europe",
    },
  ],
  libraryCount: 2,
}
export const networkLibrary: WidgetLibrary = {
  documentId: "example-library",
  name: "Northbridge Community Library",
  href: "/libraries/northbridge",
  city: "Northbridge",
  address: "1 Example Square",
  libraryType: "Public",
  country: "Example country",
  location: { lat: 51.5, lng: -0.1 },
  hours: ["Monday–Friday 09:00–17:00"],
  operationalStatus: "open",
  facilities: ["yes", "unknown"],
  why: ["Part of this library service"],
  locale: "en",
  updatedAt: "2026-01-15T12:00:00Z",
}
export const networkList: NetworkList = {
  networks: [network],
  total: 1,
  page: 1,
  pageSize: 20,
  countries: [{ name: "Example country", slug: "example-country" }],
  regions: [{ name: "Northbridge", slug: "northbridge" }],
}
export const networkDetail: NetworkDetail = {
  network,
  total: 1,
  facets: {
    countries: networkList.countries!,
    regions: networkList.regions!,
    types: ["Public"],
  },
  libraries: [networkLibrary],
  page: 1,
  pageSize: 20,
}
export const affiliation: NetworkAffiliation = {
  documentId: "example-affiliation",
  network,
  role: "Librarian",
  department: "Community services",
  publicDisplay: true,
  status: "verified",
  verifiedAt: "2026-01-15T12:00:00Z",
}
export const networkMandate: NetworkMandate = {
  documentId: "example-mandate",
  network,
  status: "approved",
  staffRole: "editor",
  approvedLibraryIds: [networkLibrary.documentId],
  ownerLibraryIds: [],
  additionsAwaitingReview: [],
  removalsAwaitingReview: [],
  version: 1,
  teamId: "example-team",
  fulfilment: {
    pending: [],
    applied: [networkLibrary.documentId],
    failures: {},
    complete: true,
  },
  reviewedAt: "2026-01-15T12:00:00Z",
}
export const networkWorkspace: NetworkWorkspace = {
  affiliations: [affiliation],
  mandates: [networkMandate],
  requests: [],
}
