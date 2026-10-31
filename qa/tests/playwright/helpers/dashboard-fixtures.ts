import type { Page } from "@playwright/test"

const metadata = {
  schemaVersion: 1,
  queryEpoch: "fixture",
  dictionaryVersion: "fixture",
  indexedThrough: "1",
  fingerprint: "dashboard-fixture",
  evaluatedAt: "2026-10-01T12:00:00.000Z",
}

export const library = {
  documentId: "dashboard-fixture",
  name: "Dashboard fixture library",
  slug: "dashboard-fixture",
  path: null,
  type: "public",
  city: "Fixture city",
  country: "Fixture country",
  region: null,
  coordinate: { lat: 51.5, lng: -0.1 },
  status: "open",
  timezone: "Europe/London",
  hours: null,
  openNow: "unknown",
  accessibility: [],
  completeness: 50,
}

export async function atlasDashboardFixtures(page: Page) {
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: null })
  )
  await page.route("**/api/drives/featured**", (route) =>
    route.fulfill({ json: { data: null } })
  )
  await page.route("**/api/atlas/**", async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/manifest"))
      return route.fulfill({
        json: {
          manifest: null,
          dictionary: { version: "fixture", entries: [] },
        },
      })
    if (url.pathname.endsWith("/library"))
      return route.fulfill({
        json: {
          library: {
            id: library.documentId,
            name: library.name,
            hours: null,
            access: [],
            services: [],
            lat: 51.5,
            lng: -0.1,
            type: "Public",
            complete: library.completeness,
            completenessKnown: true,
            status: "open",
            notices: [],
          },
        },
      })
    if (
      url.pathname.endsWith("/context") &&
      url.searchParams.get("kind") === "catalogue"
    )
      return route.fulfill({ json: { schemaVersion: 1, releases: [] } })
    if (url.pathname.endsWith("/query")) {
      const input = route.request().postDataJSON()
      if (input.purpose === "viewport")
        return route.fulfill({
          json: {
            ...metadata,
            populations: {
              listed: {
                mode: "aggregate",
                exactTotal: 1,
                complete: true,
                cells: [],
              },
            },
          },
        })
      if (input.purpose === "counts")
        return route.fulfill({
          json: {
            ...metadata,
            exactTotal: 1,
            typeGroups: { public: 1 },
            operatorGroups: {},
            facilities: [],
            accessibility: [],
            presets: [],
            foundedRange: null,
            events: 0,
            catalogue: 0,
          },
        })
      if (input.purpose === "list")
        return route.fulfill({
          json: {
            ...metadata,
            exactTotal: 1,
            reachableTotal: 1,
            hasMore: false,
            rows: [library],
          },
        })

      return route.fulfill({
        json: { ...metadata, suggestions: [], libraries: [], places: [] },
      })
    }

    return route.fulfill({
      status: 503,
      json: { error: "Fixture deliberately has no analysis data" },
    })
  })
}
