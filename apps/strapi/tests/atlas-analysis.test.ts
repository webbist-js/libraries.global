import { afterEach, expect, it, vi } from "vitest"

import { requestAtlasReach } from "../src/utils/atlas-analysis"

const request = { schemaVersion: 1, libraryId: "one", mode: "walking" }
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it("rechecks the published canonical record before touching any job cache", async () => {
  const findOne = vi.fn().mockResolvedValue(null)
  const database = vi.fn()
  const strapi = {
    documents: vi.fn(() => ({ findOne })),
    db: { connection: database },
  }
  expect(
    (await requestAtlasReach(strapi, request, "a".repeat(64), 20)).status
  ).toBe(404)
  expect(findOne).toHaveBeenCalledWith(
    expect.objectContaining({ status: "published", documentId: "one" })
  )
  expect(database).not.toHaveBeenCalled()
  for (const library of [
    { libraryType: { name: "Mobile" }, location: { lat: 51, lng: 0 } },
    { libraryType: { name: "Digital" }, location: { lat: 51, lng: 0 } },
    { operationalStatus: "permanently_closed", location: { lat: 51, lng: 0 } },
    { operationalStatus: "temporarily_closed", location: { lat: 51, lng: 0 } },
    { location: null },
    { location: { lat: 100, lng: 0 } },
  ]) {
    findOne.mockResolvedValue(library)
    expect(
      (await requestAtlasReach(strapi, request, "a".repeat(64), 20)).body.state
    ).toBe("unsupported")
  }
  expect(database).not.toHaveBeenCalled()
})

it.each([
  ["CA", { lat: 51.64139, lng: -121.29562 }],
  ["MX", { lat: 21.85783, lng: -102.25617 }],
])(
  "keeps an imported %s library usable without inventing Reach coverage or queuing work",
  async (iso2, location) => {
    const database = vi.fn()
    const strapi = {
      documents: vi.fn(() => ({
        findOne: vi.fn().mockResolvedValue({
          libraryType: { name: "Public" },
          operationalStatus: "unknown",
          country: { iso2 },
          location,
        }),
      })),
      db: { connection: database },
    }
    vi.stubEnv("ANALYSIS_SERVICE_URL", "http://analysis.test")
    vi.stubEnv("ANALYSIS_SERVICE_TOKEN", "test-token")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            id: "uk-v1",
            countries: ["GB-ENG", "GB-WLS", "GB-SCT"],
            originBounds: [-9, 49, 3, 61],
          },
        ])
      )
    )

    const response = await requestAtlasReach(
      strapi,
      request,
      "a".repeat(64),
      20
    )
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      libraryId: "one",
      state: "unsupported",
      message:
        "Routing and population coverage is not installed for this Library.",
    })
    expect(response.body).not.toHaveProperty("contours")
    expect(database).not.toHaveBeenCalled()
  }
)
it("does not admit arbitrary coordinates or unsupported countries to the compute queue", async () => {
  const findOne = vi.fn().mockResolvedValue({
    libraryType: { name: "Public" },
    country: { iso2: "FR" },
    location: { lat: 49, lng: 2 },
  })
  const database = vi.fn()
  const strapi = {
    documents: vi.fn(() => ({ findOne })),
    db: { connection: database },
  }
  await expect(
    requestAtlasReach(strapi, { ...request, lat: 51 }, "a".repeat(64), 20)
  ).rejects.toThrow("Invalid Reach request")
  expect(findOne).not.toHaveBeenCalled()
  vi.stubEnv("ANALYSIS_SERVICE_URL", "http://analysis.test")
  vi.stubEnv("ANALYSIS_SERVICE_TOKEN", "test-token")
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json([
        {
          id: "england-v1",
          countries: ["GB-ENG"],
          originBounds: [-7, 49, 3, 56],
        },
      ])
    )
  )
  expect(
    (await requestAtlasReach(strapi, request, "a".repeat(64), 20)).body.state
  ).toBe("unsupported")
  expect(database).not.toHaveBeenCalled()
})
