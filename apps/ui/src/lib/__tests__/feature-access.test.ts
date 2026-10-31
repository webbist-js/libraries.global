import { describe, expect, it } from "vitest"

import {
  CONTRIBUTION_DISCOVERY_PATHS,
  FEATURE_ENTRY_PATHS,
  STAFF_DISCOVERY_PATHS,
  featureSignInHref,
} from "@/lib/feature-access"

const callback = (href: string) =>
  new URL(href, "https://example.test").searchParams.get("callbackUrl")

describe("feature discovery entry points", () => {
  it("preserves the exact section and query through locale-aware sign-in", () => {
    expect(
      callback(
        featureSignInHref(
          "networks",
          "fr",
          "/staff/networks?network=public-network&request=own-request"
        )
      )
    ).toBe("/fr/staff/networks?network=public-network&request=own-request")
    expect(
      callback(
        featureSignInHref(
          "add",
          "cs",
          "/cs/contribute/index/new?country=czechia&name=Test"
        )
      )
    ).toBe("/cs/contribute/index/new?country=czechia&name=Test")
    expect(callback(featureSignInHref("widgets", "en"))).toBe(
      FEATURE_ENTRY_PATHS.widgets
    )
  })
  it.each([
    "https://elsewhere.test",
    "//elsewhere.test",
    String.raw`/\elsewhere.test`,
    "/staff\n/billing",
  ])("rejects an unsafe return path: %s", (path) => {
    expect(featureSignInHref("teams", "en", path)).toBe(
      "/auth/signin?callbackUrl=%2Fstaff%2Fteams"
    )
  })
  it("whitelists entry pages, without treating private descendants as public guest pages", () => {
    expect(STAFF_DISCOVERY_PATHS).toContain("/staff/networks")
    expect(CONTRIBUTION_DISCOVERY_PATHS).toContain(
      "/contribute/knowledge/apply"
    )
    for (const path of [
      "/staff/teams/billing",
      "/staff/teams/join/secret",
      "/staff/teams/widgets/new",
      "/staff/teams/widgets/private-widget/manage",
      "/staff/library/edit",
      "/staff/networks/libraries",
      "/contribute/submissions",
      "/contribute/knowledge/private-draft",
      "/contribute/correct/library",
    ])
      expect([
        ...STAFF_DISCOVERY_PATHS,
        ...CONTRIBUTION_DISCOVERY_PATHS,
      ]).not.toContain(path)
  })
})
