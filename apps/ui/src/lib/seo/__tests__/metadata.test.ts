import { describe, expect, it, vi } from "vitest"

const { production } = vi.hoisted(() => ({ production: vi.fn(() => true) }))
vi.mock("@/lib/general-helpers", () => ({ isProduction: production }))
vi.mock("@/lib/env-vars", () => ({
  getEnvVar: () => "https://libraries.global",
}))
vi.mock("@/lib/navigation", () => ({ routing: { defaultLocale: "en" } }))
vi.mock("@/lib/live-locales", () => ({ LIVE_LOCALES: ["en"] }))

import {
  buildMetadata,
  clampDescription,
  cmsRobots,
  DEFAULT_SOCIAL_IMAGE,
  libraryTitle,
} from "../metadata"

describe("public metadata", () => {
  it("keeps library titles useful without repeating the city or truncating the institution name", () => {
    expect(
      libraryTitle(
        "Montour Falls Memorial Library",
        "Montour Falls",
        "United States"
      )
    ).toEqual({
      absoluteTitle: "Montour Falls Memorial Library, United States",
    })
    expect(
      libraryTitle(
        "Toledo-Lucas County Public Library, Maumee Branch",
        "Maumee",
        "United States"
      )
    ).toEqual({
      absoluteTitle: "Toledo-Lucas County Public Library, Maumee Branch",
    })
    expect(libraryTitle("Central Library", "Leeds")).toEqual({
      title: "Central Library, Leeds",
    })
  })
  it("uses a page-specific fallback when CMS fields are blank", () => {
    const metadata = buildMetadata({
      title: "British Library",
      description: "Opening hours and collections in London.",
      path: "europe/england/london/british-library",
      locale: "en",
      seo: { metaTitle: "  ", metaDescription: "\n" },
    })
    expect(metadata.title).toBe("British Library")
    expect(metadata.description).toBe(
      "Opening hours and collections in London."
    )
    expect(metadata.alternates?.canonical).toBe(
      "/europe/england/london/british-library"
    )
    expect(metadata.openGraph).toMatchObject({
      title: metadata.title,
      description: metadata.description,
    })
    expect(metadata.twitter).toMatchObject({
      images: [DEFAULT_SOCIAL_IMAGE],
      card: "summary_large_image",
    })
  })

  it("strips markup and decodes entities before clamping descriptions", () => {
    expect(
      clampDescription(
        "<p>Books &amp; stories</p>\n<p>Read &#x2014; learn.</p>"
      )
    ).toBe("Books & stories Read — learn.")
    expect(clampDescription(" ")).toBeUndefined()
    expect(
      clampDescription("A library with collections. ".repeat(20))!.length
    ).toBeLessThanOrEqual(160)
  })

  it.each([
    "none",
    "NONE",
    "nofollow, noindex",
    "NOINDEX, FOLLOW",
    "noindex, max-snippet:0",
  ])("honours CMS %s", (directive) => {
    expect(
      buildMetadata({ locale: "en", seo: { metaRobots: directive } }).robots
    ).toMatchObject({ index: false })
  })

  it("retains follow directives while restricting indexing", () => {
    expect(cmsRobots("NOINDEX, FOLLOW")).toEqual({ index: false, follow: true })
    expect(
      buildMetadata({
        locale: "en",
        robots: "noindex-follow",
        seo: { metaRobots: "index" },
      }).robots
    ).toEqual({ index: false, follow: true })
    expect(
      buildMetadata({ locale: "en", seo: { metaRobots: "nofollow" } }).robots
    ).toEqual({ index: true, follow: false })
  })

  it("keeps non-live locale copies and non-production pages out of the index", () => {
    expect(buildMetadata({ locale: "cs" }).robots).toMatchObject({
      index: false,
    })
    production.mockReturnValueOnce(false)
    expect(buildMetadata({ locale: "en" }).robots).toMatchObject({
      index: false,
    })
  })
})
