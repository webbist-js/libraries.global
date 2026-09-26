import { describe, expect, it } from "vitest"

import { luci } from "../../src/connectors/luci"
import type { CatalogueConfig } from "../../src/types"
import { fixture, mockHttp } from "../helpers"

// Fixtures recorded from Luton and Sutton (Sept 2026). Register pages are trimmed
// to the RSC chunks that carry the patron fields; the home page to its meta tags.

const config: CatalogueConfig = {
  system: "luci",
  baseUrl: "https://www.lutonlibraries.co.uk/",
  settings: { home: "home" },
}

const RECORD_ID = "69DC044957C3442E9D384C5DF4E074:57836"

describe("luci", () => {
  it("lists branches with their codes from the registration page", async () => {
    const { http, requests } = mockHttp([
      { match: "/user/register", body: fixture("luci/register-luton.html") },
    ])
    const branches = await luci.listBranches(config, http)

    expect(requests[0]!.url).toBe(
      "https://www.lutonlibraries.co.uk/user/register"
    )
    expect(branches).toEqual([
      { name: "Leagrave Library", code: "LUTLE" },
      { name: "Lewsey Library", code: "LUTLF" },
      { name: "Luton Central Library", code: "LUTLC" },
      { name: "Marsh Farm Library", code: "LUTLM" },
      { name: "Stopsley Library", code: "LUTLS" },
    ])
  })

  it("works for another installation", async () => {
    const { http } = mockHttp([
      { match: "/user/register", body: fixture("luci/register-sutton.html") },
    ])
    const branches = await luci.listBranches(
      {
        system: "luci",
        baseUrl: "https://libraries.sutton.gov.uk/",
        settings: {},
      },
      http
    )
    expect(branches).toContainEqual({ name: "Cheam Library", code: "SUTCHE" })
    expect(branches.length).toBeGreaterThan(3)
  })

  it("reads the Pages Router __NEXT_DATA__ shape too", async () => {
    const nextData = JSON.stringify({
      props: {
        pageProps: {
          patronFields: [
            { code: "patron_email", optionList: [] },
            {
              code: "patron_homeLocation",
              optionList: [{ key: "ABC", value: "A [Branch] Library " }],
            },
          ],
        },
      },
    })
    const { http } = mockHttp([
      {
        match: "/user/register",
        body: `<html><script id="__NEXT_DATA__" type="application/json">${nextData}</script></html>`,
      },
    ])
    expect(await luci.listBranches(config, http)).toEqual([
      { name: "A [Branch] Library", code: "ABC" },
    ])
  })

  it("tallies copies per branch and links the record", async () => {
    const { http, requests } = mockHttp([
      {
        match: "lutonlibraries.co.uk/home",
        body: fixture("luci/home-luton.html"),
      },
      {
        match: "/api/results",
        method: "POST",
        body: fixture("luci/results-luton.json"),
      },
      { match: "/api/record?", body: fixture("luci/record-luton.json") },
    ])
    const result = await luci.searchByIsbn(config, "9780747532743", http)

    expect(result.found).toBe(true)
    expect(result.recordId).toBe(RECORD_ID)
    expect(result.recordUrl).toBe(
      `https://www.lutonlibraries.co.uk/manifestations/${RECORD_ID}?source=ILSWS`
    )
    expect(result.holdings).toContainEqual({
      branch: "BD Valence Library (Barking & Dagenham)",
      available: 3,
      unavailable: 0,
    })
    expect(result.holdings).toContainEqual({
      branch: "BD Barking Library (Barking and Dagenham)",
      available: 0,
      unavailable: 1,
    })
    const total = result.holdings.reduce(
      (n, h) => n + h.available + h.unavailable,
      0
    )
    expect(total).toBe(23)

    const search = requests.find((r) => r.url.endsWith("/api/results"))!
    expect(JSON.parse(search.body!)).toMatchObject({
      searchTerm: "9780747532743",
    })
    expect(requests.at(-1)!.url).toBe(
      `https://www.lutonlibraries.co.uk/api/record?id=${RECORD_ID}&source=ILSWS`
    )
  })

  it("uses the home setting to find the app id", async () => {
    const { http, requests } = mockHttp([
      { match: "/bookshelf", body: fixture("luci/home-luton.html") },
      { match: "/api/results", method: "POST", body: '{"records":[]}' },
    ])
    await luci.searchByIsbn(
      { ...config, settings: { home: "bookshelf" } },
      "9780747532743",
      http
    )
    expect(requests[0]!.url).toBe("https://www.lutonlibraries.co.uk/bookshelf")
  })

  it("reports not found when no physical record matches the ISBN", async () => {
    const { http } = mockHttp([
      { match: "/home", body: fixture("luci/home-luton.html") },
      {
        match: "/api/results",
        method: "POST",
        body: fixture("luci/results-luton.json"),
      },
    ])
    expect(await luci.searchByIsbn(config, "9780000000002", http)).toEqual({
      found: false,
      holdings: [],
    })
  })

  // Trimmed from a live Sutton response to its OverDrive record.
  it("treats e-content-only matches as not found", async () => {
    const { http } = mockHttp([
      { match: "/home", body: fixture("luci/home-luton.html") },
      {
        match: "/api/results",
        method: "POST",
        body: fixture("luci/results-econtent-only.json"),
      },
    ])
    expect(await luci.searchByIsbn(config, "9780000000002", http)).toEqual({
      found: false,
      holdings: [],
    })
  })

  it("accepts the older { data: { copies } } record shape", async () => {
    const { http } = mockHttp([
      { match: "/home", body: fixture("luci/home-luton.html") },
      {
        match: "/api/results",
        method: "POST",
        body: fixture("luci/results-luton.json"),
      },
      {
        match: "/api/record?",
        body: JSON.stringify({
          data: {
            copies: [
              {
                location: { locationName: "Stopsley Library" },
                available: true,
              },
              {
                location: { locationName: "Stopsley Library" },
                available: false,
              },
            ],
          },
        }),
      },
    ])
    const result = await luci.searchByIsbn(config, "9780747532743", http)
    expect(result.holdings).toEqual([
      { branch: "Stopsley Library", available: 1, unavailable: 1 },
    ])
  })
})
