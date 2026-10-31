import { expect, it } from "vitest"

import { dashboardDirection } from "./dashboard-navigation"

it.each([
  ["/europe", "/europe/england", "nav-forward"],
  ["/fr/europe/england/cornwall", "/fr/europe/england", "nav-back"],
  ["/map?lib=record", "/europe/england/cornwall/library", "atlas-forward"],
  ["/europe/england/cornwall/library", "/libraries", "nav-back"],
  ["/developers", "/developers/playground", "section-forward"],
  ["/developers/keys", "/developers", "section-back"],
  ["/developers/keys", "/developers/usage", "section-forward"],
  ["/legal", "/legal/privacy", "section-forward"],
  ["/legal/privacy", "/legal", "section-back"],
  ["/profile/reader", "/profile/reader/following", "section-forward"],
  ["/library-networks", "/library-networks/county-service", "section-forward"],
  ["/library-networks/county-service", "/library-networks", "section-back"],
  ["/europe/england", "/europe/france", "nav-forward"],
  ["/europe/england?sort=name", "/europe/england?sort=count", null],
  ["/journal", "/journal/news/example", "section-forward"],
  ["/staff", "/staff/central-library/edit", "section-forward"],
  ["/staff/central-library/notices", "/staff/central-library", "section-back"],
  ["/staff/teams/billing", "/staff/teams/api", "section-forward"],
  ["/contribute", "/contribute/index", "section-forward"],
  ["/contribute/index/central", "/contribute/index", "section-back"],
  ["/moderation", "/moderation/submission-1", "section-forward"],
  ["/moderation/submission-1", "/moderation?category=claims", "section-back"],
  ["/contribute", "/moderation", null],
  ["/profile/example", "/europe", null],
  ["/libraries", "/library-networks", null],
])("classifies %s → %s by hierarchy", (from, to, expected) => {
  expect(dashboardDirection(from, to)).toBe(expected)
})

it.each([
  ["/europe/england/cornwall/library", "/map", "atlas-back"],
  ["/fr/europe", "/fr/map", "atlas-back"],
  ["/europe", "#countries", null],
  ["/europe", "https://example.test/europe/england", null],
  ["/europe", "//example.test/europe/england", null],
  ["/map", "/map?lib=selected", null],
  ["/fr/europe", "/cs/europe", null],
])(
  "keeps route and in-page changes distinct: %s → %s",
  (from, to, expected) => {
    expect(dashboardDirection(from, to)).toBe(expected)
  }
)

it("uses visible sidebar order, including localized links and nested destinations", () => {
  const tabs = ["/fr/staff", "/fr/staff/teams/billing", "/fr/staff/teams/api"]
  expect(
    dashboardDirection("/staff/teams/billing", "/staff/teams/api", tabs)
  ).toBe("section-forward")
  expect(
    dashboardDirection("/staff/teams/api/keys", "/staff/teams/billing", tabs)
  ).toBe("section-back")
  expect(dashboardDirection("/staff/teams/api", "/staff", tabs)).toBe(
    "section-back"
  )
})

it("orders Knowledge and Journal by the global sidebar, including article routes", () => {
  const destinations = [
    "/map",
    "/libraries",
    "/library-networks",
    "/community",
    "/journal",
    "/knowledge",
  ]
  expect(
    dashboardDirection("/knowledge/guides/search", "/journal", destinations)
  ).toBe("section-back")
  expect(dashboardDirection("/journal", "/knowledge", destinations)).toBe(
    "section-forward"
  )
})
