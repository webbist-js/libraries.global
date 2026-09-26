import { describe, expect, it } from "vitest"

import { ukLibraryServices } from "../src/data"
import { detectFromHtml, detectFromUrl } from "../src/detect"

describe("detectFromUrl", () => {
  it.each([
    [
      "https://aberdeencity.spydus.co.uk/",
      "spydus",
      "https://aberdeencity.spydus.co.uk/",
    ],
    [
      "https://ynysmon.spydus.co.uk/cgi-bin/spydus.exe/MSGTRN/OPAC/HOME",
      "spydus",
      "https://ynysmon.spydus.co.uk/",
    ],
    [
      "https://llc.ent.sirsidynix.net.uk/client/en_GB/brent/search/results?qu=x",
      "enterprise",
      "https://llc.ent.sirsidynix.net.uk/client/en_GB/brent/",
    ],
    [
      "https://prism.librarymanagementcloud.co.uk/barnet/items?query=x",
      "prism",
      "https://prism.librarymanagementcloud.co.uk/barnet/",
    ],
    [
      "https://catalogue.knowsley.gov.uk/cgi-bin/koha/opac-main.pl",
      "koha",
      "https://catalogue.knowsley.gov.uk/",
    ],
    [
      "https://libcat.renfrewshire.gov.uk/iguana/www.main.cls",
      "iguana",
      "https://libcat.renfrewshire.gov.uk/iguana/",
    ],
    [
      "https://beds-arena.culturalservices.net/web/arena/welcome",
      "arena",
      "https://beds-arena.culturalservices.net/web/arena/",
    ],
  ])("%s → %s", (url, system, baseUrl) => {
    const d = detectFromUrl(url)
    expect(d?.system).toBe(system)
    expect(d?.baseUrl).toBe(baseUrl)
  })

  it("keeps a non-default Spydus OPAC reference", () => {
    expect(
      detectFromUrl(
        "https://ynysmon.spydus.co.uk/cgi-bin/spydus.exe/MSGTRN/OPAC/HOME"
      )?.settings.opacReference
    ).toBe("OPAC")
  })

  it("flags Arena settings that can't be inferred", () => {
    expect(
      detectFromUrl("https://arena.yourlondonlibrary.net/web/bexley/")
        ?.missingSettings
    ).toEqual(["arenaName", "organisationId"])
  })

  it("returns null for unknown or invalid URLs", () => {
    expect(detectFromUrl("https://www.example.gov.uk/libraries")).toBeNull()
    expect(detectFromUrl("not a url")).toBeNull()
  })

  // Accuracy check against every upstream service whose system is identifiable
  // from the URL alone. Self-hosted Aspen/LUCI/Koha on council domains need
  // HTML fingerprinting and are excluded.
  it("agrees with the LibrariesHacked dataset for URL-identifiable systems", () => {
    const urlDetectable = new Set(["spydus", "enterprise", "prism", "iguana"])
    const services = ukLibraryServices.filter((s) =>
      urlDetectable.has(s.catalogue.system)
    )
    const results = services.map((s) => ({
      name: s.name,
      expected: s.catalogue.system,
      got: detectFromUrl(s.catalogue.baseUrl)?.system ?? null,
    }))
    // Never guess wrong; unknown (null) is fine and falls through to HTML.
    const wrong = results.filter((r) => r.got && r.got !== r.expected)
    const hits = results.filter((r) => r.got === r.expected)

    expect(services.length).toBeGreaterThan(140)
    expect(wrong).toEqual([])
    expect(hits.length / services.length).toBeGreaterThan(0.95)
  })
})

describe("detectFromHtml", () => {
  it("reads the Koha generator version", () => {
    const d = detectFromHtml(
      '<meta name="generator" content="Koha 24.05.02.000" />',
      "https://cwflibraries.org.uk/"
    )
    expect(d).toMatchObject({ system: "koha", version: "24", via: "html" })
  })

  it("recognises Aspen Discovery", () => {
    expect(
      detectFromHtml(
        "<footer>Powered by Aspen Discovery</footer>",
        "https://libraries.rbkc.gov.uk/"
      )?.system
    ).toBe("aspen")
  })
})

describe("ukLibraryServices", () => {
  it("maps upstream records onto CatalogueConfig", () => {
    const anglesey = ukLibraryServices.find((s) => s.gssCode === "W06000001")
    expect(anglesey?.catalogue).toMatchObject({
      system: "spydus",
      baseUrl: "https://ynysmon.spydus.co.uk/",
      settings: { opacReference: "OPAC" },
    })
    const koha = ukLibraryServices.find((s) => s.catalogue.system === "koha")
    expect(koha?.catalogue.version).toMatch(/^2[34]$/)
  })
})

describe("listBranches", () => {
  it("treats an empty branch list as a parse failure", async () => {
    const { listBranches } = await import("../src")
    const { mockHttp } = await import("./helpers")
    const { http } = mockHttp([
      { match: "MSGTRN", body: "Could not connect to database" },
    ])
    const out = await listBranches(
      { system: "spydus", baseUrl: "https://x.spydus.co.uk/", settings: {} },
      http
    )
    expect(out).toMatchObject({ ok: false, error: { code: "parse" } })
  })
})
