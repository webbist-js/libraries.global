import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { reversePlace, searchPlaces } from "../photon"
import { BRITISH_LIBRARY, HAWORTH_CHURCHYARD } from "./photon-fixtures"

const fetchMock = vi.fn()

function requested() {
  const [url, init] = fetchMock.mock.calls[0] ?? []

  return {
    url: new URL(String(url)),
    init: init as RequestInit & { next?: { revalidate?: number } },
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(Response.json({ features: [BRITISH_LIBRARY] }))
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllEnvs())

describe("searchPlaces", () => {
  it("asks komoot's Photon for six English results, as us, cached a day", async () => {
    const places = await searchPlaces("British Library")
    const { url, init } = requested()
    expect(url.origin + url.pathname).toBe("https://photon.komoot.io/api")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "British Library",
      limit: "6",
      lang: "en",
    })
    expect(new Headers(init.headers).get("User-Agent")).toBe(
      "libraries.global (https://libraries.global; info@libraries.global)"
    )
    expect(init.next?.revalidate).toBe(86_400)
    expect(places.map((p) => p.label)).toEqual(["British Library"])
  })

  it("uses PHOTON_URL when it is set", async () => {
    vi.stubEnv("PHOTON_URL", "https://photon.example.org/")
    await searchPlaces("Haworth")
    expect(requested().url.href).toMatch(
      /^https:\/\/photon\.example\.org\/api\?/
    )
  })

  it("throws when Photon fails", async () => {
    fetchMock.mockResolvedValue(new Response("busy", { status: 503 }))
    await expect(searchPlaces("Haworth")).rejects.toThrow()
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    await expect(searchPlaces("Haworth")).rejects.toThrow()
  })
})

describe("reversePlace", () => {
  it("rounds the point to five places and returns the nearest place", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ features: [HAWORTH_CHURCHYARD] })
    )
    const place = await reversePlace(53.83092871, -1.95663181)
    const { url } = requested()
    expect(url.pathname).toBe("/reverse")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lat: "53.83093",
      lon: "-1.95663",
      limit: "1",
      lang: "en",
    })
    expect(place?.label).toBe("Haworth Churchyard")
  })

  it("is null when nothing is near", async () => {
    fetchMock.mockResolvedValue(Response.json({ features: [] }))
    expect(await reversePlace(0, 0)).toBeNull()
  })
})
