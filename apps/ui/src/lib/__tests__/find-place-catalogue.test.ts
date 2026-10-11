import { afterEach, describe, expect, it, vi } from "vitest"

import { contributionPlacePrefill } from "../contribution-place-server"
import { findPlaceCatalogue } from "../find-place-catalogue-server"

const london = {
  documentId: "london",
  name: "Greater London",
  slug: "greater-london",
  areaTypeLabel: "Borough",
  areasSectionLabel: "Boroughs",
  country: {
    documentId: "eng",
    name: "England",
    slug: "england",
    areaTypeLabel: "District",
    continent: { documentId: "eu", name: "Europe", slug: "europe" },
  },
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe("CMS place metadata", () => {
  it("names a zero-record region with CMS overrides and complete ancestry", async () => {
    vi.stubEnv("STRAPI_URL", "http://cms.example")
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: [london] }))
    vi.stubGlobal("fetch", fetch)
    const result = await findPlaceCatalogue(
      { level: "region", slug: "greater-london" },
      "cs"
    )
    expect(result?.region).toEqual({
      documentId: "london",
      name: "Greater London",
      slug: "greater-london",
      areaTypeLabel: "Borough",
      areasSectionLabel: "Boroughs",
    })
    expect(result?.country?.areaTypeLabel).toBe("District")
    expect(result?.continent?.documentId).toBe("eu")
    expect(fetch.mock.calls[0]?.[0]).toContain("locale=cs")
    expect(fetch.mock.calls[0]?.[0]).toContain("pagination[limit]=1")
    expect(fetch.mock.calls[0]?.[1].next.tags).toContain("region")
  })
  it("falls back to the default published locale", async () => {
    vi.stubEnv("STRAPI_URL", "http://cms.example")
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: [] }))
      .mockResolvedValueOnce(Response.json({ data: [london] }))
    vi.stubGlobal("fetch", fetch)
    expect(
      (
        await findPlaceCatalogue(
          { level: "region", slug: "greater-london" },
          "fr"
        )
      )?.region?.name
    ).toBe("Greater London")
    expect(fetch.mock.calls[1]?.[0]).toContain("locale=en")
  })
  it("only prefills IDs from consistent catalogue ancestry", async () => {
    vi.stubEnv("STRAPI_URL", "http://cms.example")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ data: [london] }))
    )
    expect(
      await contributionPlacePrefill(
        { region: "greater-london", country: "england" },
        "en"
      )
    ).toEqual({
      regionDocumentId: "london",
      countryDocumentId: "eng",
      continentDocumentId: "eu",
    })
    expect(
      await contributionPlacePrefill(
        { region: "greater-london", country: "france" },
        "en"
      )
    ).toEqual({})
  })
  it("permits index fallback when CMS is unavailable", async () => {
    vi.stubEnv("STRAPI_URL", "http://cms.example")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("down", { status: 503 }))
    )
    expect(
      await findPlaceCatalogue({ level: "region", slug: "greater-london" })
    ).toBeUndefined()
  })
})
