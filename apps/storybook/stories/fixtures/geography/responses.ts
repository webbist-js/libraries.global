import {
  atlasLibraries,
  atlasQueryFixture,
  contextRelease,
  networkSelection,
  populationResponse,
} from "./atlas"
import { publicLive, timetable, liveSettings, stopHit } from "./mobile"

const libraryHit = {
  documentId: "example-library",
  name: "Northbridge Community Library",
  slug: "northbridge-community-library",
  libraryType: "Public",
  city: "Northbridge",
  continent_slug: "europe",
  country_slug: "example-country",
  region_slug: "northbridge",
  _geo: { lat: 51.5, lng: -0.1 },
}
const searchResult = {
  estimatedTotalHits: 1,
  totalHits: 1,
  totalPages: 1,
  page: 1,
  hitsPerPage: 20,
  offset: 0,
  limit: 20,
  processingTimeMs: 1,
  query: "",
  facetDistribution: {},
  facetStats: {},
}

/** Every endpoint is synthetic; unmatched requests remain blocked by the preview. */
export const geographyResponses = {
  "POST /api/search/indexes/mobile-stop/search": {
    body: {
      ...searchResult,
      hits: [stopHit],
      facetDistribution: { library_document_id: { "example-mobile": 1 } },
    },
  },
  "POST /api/search/indexes/library/search": {
    body: { ...searchResult, hits: [libraryHit] },
  },
  "POST /api/search/multi-search": {
    body: {
      results: [
        { ...searchResult, indexUid: "library", hits: [libraryHit] },
        { ...searchResult, indexUid: "mobile-stop", hits: [stopHit] },
      ],
    },
  },
  "POST /api/mobile/live/confirm": { body: { ok: true } },

  "GET /api/mobile/live": { body: { states: [publicLive] } },
  "GET /api/mobile/example-mobile/timetable": {
    body: {
      documentId: "example-mobile",
      name: "Northbridge Mobile Library",
      path: "/libraries/example-mobile",
      timezone: "Europe/London",
      status: "open",
      updatedAt: "2026-01-15T12:00:00Z",
      timetable,
      notices: [],
    },
  },
  "GET /api/mobile/live/settings": { body: liveSettings },
  "GET /api/search/mobile-stops": {
    body: { data: [stopHit], hits: [stopHit], total: 1 },
  },
  "GET /api/search/libraries": {
    body: {
      data: [
        {
          documentId: "example-library",
          name: "Northbridge Community Library",
          slug: "northbridge-library",
          libraryType: "Public",
        },
      ],
    },
  },
  "GET /api/geocode/search": { body: { data: [] } },
  "GET /api/geocode/reverse": { body: { data: null } },
  "GET /api/relations/continents": {
    body: {
      data: [{ documentId: "example-continent", name: "Example continent" }],
    },
  },
  "GET /api/relations/countries": {
    body: {
      data: [
        { documentId: "example-country", name: "Example country", iso2: "EX" },
      ],
    },
  },
  "GET /api/relations/regions": {
    body: { data: [{ documentId: "example-region", name: "Northbridge" }] },
  },
  "GET /api/relations/areas": {
    body: { data: [{ documentId: "example-area", name: "Market district" }] },
  },
  "GET /api/relations/library-types": {
    body: {
      data: [
        { documentId: "example-public", name: "Public" },
        { documentId: "example-mobile", name: "Mobile" },
      ],
    },
  },
  "GET /api/relations/accessibility": {
    body: {
      data: [{ documentId: "example-step-free", name: "Step-free entrance" }],
    },
  },
  "GET /api/relations/amenities": {
    body: {
      data: [{ documentId: "example-reading-room", name: "Reading room" }],
    },
  },
  "GET /api/relations/services": {
    body: {
      data: [{ documentId: "example-internet", name: "Internet access" }],
    },
  },
  "GET /api/atlas/manifest": {
    body: {
      manifest: null,
      dictionary: { version: "example-v1", entries: [] },
    },
  },
  "POST /api/atlas/query": { body: atlasQueryFixture },
  "GET /api/atlas/context": {
    body: { releases: [contextRelease], areas: [], next: null },
  },
  "GET /api/atlas/population": { body: populationResponse },
  "GET /api/atlas/networks": {
    body: {
      networks: [networkSelection],
      selected: networkSelection,
      countries: [],
      regions: [],
      next: null,
    },
  },
  "GET /api/public-proxy/api/libraries/atlas": {
    body: {
      type: "FeatureCollection",
      features: atlasLibraries.map(({ lat, lng, ...properties }) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties,
      })),
    },
  },
  "GET /api/public-proxy/api/libraries": {
    body: {
      data: [
        {
          summary: "A welcoming community library.",
          streetAddress: "1 Example Square",
          postalCode: "EX1 1AA",
          catalogueUrl: "https://example.invalid/catalogue",
          openingTimes: null,
          updatedAt: "2026-01-15T12:00:00Z",
          heroImage: { url: "/library-placeholder.svg" },
        },
      ],
    },
  },
}
