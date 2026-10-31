import type { FindResult } from "@/lib/find-search"

import { libraryHit } from "./server"

export const findResult: FindResult = {
  hits: [libraryHit],
  total: 1,
  pageCount: 1,
  facets: {
    libraryType: { public: 1 },
    accessibility: { "Step-free access": 1 },
    services: { "Free Wi-Fi": 1 },
    needs: { hours: 1 },
    hoursKnown: 0,
    digital: 0,
    openNow: 0,
  },
  location: {
    continents: [{ slug: "europe", name: "Europe", count: 1 }],
    countries: [{ slug: "united-kingdom", name: "United Kingdom", count: 1 }],
    regions: [{ slug: "northbridge", name: "Northbridge", count: 1 }],
    areas: [],
  },
}
