import { expect, it } from "vitest"

import { dashboardDirection } from "./dashboard-navigation"

it.each([
  ["/europe", "/europe/england", "nav-forward"],
  ["/fr/europe/england/cornwall", "/fr/europe/england", "nav-back"],
  ["/map?lib=record", "/europe/england/cornwall/library", "nav-forward"],
  ["/europe/england/cornwall/library", "/libraries", "nav-back"],
  ["/developers", "/developers/playground", "nav-forward"],
  ["/developers/keys", "/developers", "nav-back"],
  ["/developers/keys", "/developers/usage", null],
  ["/legal", "/legal/privacy", "nav-forward"],
  ["/legal/privacy", "/legal", "nav-back"],
  ["/profile/reader", "/profile/reader/following", "nav-forward"],
  ["/library-networks", "/library-networks/county-service", "nav-forward"],
  ["/library-networks/county-service", "/library-networks", "nav-back"],
  ["/europe/england", "/europe/france", null],
  ["/europe/england?sort=name", "/europe/england?sort=count", null],
  ["/journal", "/journal/news/example", "nav-forward"],
  ["/staff", "/staff/central-library/edit", "nav-forward"],
  ["/staff/central-library/notices", "/staff/central-library", "nav-back"],
  ["/staff/teams/billing", "/staff/teams/api", null],
  ["/contribute", "/contribute/index", "nav-forward"],
  ["/contribute/index/central", "/contribute/index", "nav-back"],
  ["/moderation", "/moderation/submission-1", "nav-forward"],
  ["/moderation/submission-1", "/moderation?category=claims", "nav-back"],
  ["/contribute", "/moderation", null],
  ["/profile/example", "/europe", null],
  ["/libraries", "/library-networks", null],
])("classifies %s → %s by hierarchy", (from, to, expected) => {
  expect(dashboardDirection(from, to)).toBe(expected)
})
