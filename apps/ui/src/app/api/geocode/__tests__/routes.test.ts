import { beforeEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({
  value: null as null | { user: { id: string } },
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => session.value,
}))
const photon = vi.hoisted(() => ({
  searchPlaces: vi.fn(),
  reversePlace: vi.fn(),
}))
vi.mock("@/lib/geocode/photon", () => photon)

const search = await import("../search/route")
const reverse = await import("../reverse/route")

const get = (path: string) => new Request(`http://localhost${path}`)

let user = 0
beforeEach(() => {
  vi.clearAllMocks()
  // A new user per test: the rate limiter's counts outlive a test.
  session.value = { user: { id: `u${++user}` } }
  photon.searchPlaces.mockResolvedValue([
    { id: "W1", label: "British Library" },
  ])
  photon.reversePlace.mockResolvedValue({
    id: "W2",
    label: "Haworth Churchyard",
  })
})

describe("GET /api/geocode/search", () => {
  it("supports public stop finding with a lower per-IP rate limit", async () => {
    session.value = null
    const res = await search.GET(get("/api/geocode/search?q=British"))
    expect(res.status).toBe(200)
    expect(photon.searchPlaces).toHaveBeenCalledWith("British")
    for (let i = 1; i < 20; i++)
      await search.GET(get("/api/geocode/search?q=British"))
    expect(
      (await search.GET(get("/api/geocode/search?q=British"))).status
    ).toBe(429)
  })

  it("needs 3 to 200 characters", async () => {
    for (const q of ["", "ab", "  ab  ", "x".repeat(201)]) {
      const res = await search.GET(
        get(`/api/geocode/search?q=${encodeURIComponent(q)}`)
      )
      expect(res.status).toBe(400)
    }
    expect(photon.searchPlaces).not.toHaveBeenCalled()
  })

  it("returns the places for the trimmed query", async () => {
    const res = await search.GET(
      get("/api/geocode/search?q=%20British%20Library%20")
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: [{ id: "W1", label: "British Library" }],
    })
    expect(photon.searchPlaces).toHaveBeenCalledWith("British Library")
  })

  it("answers 502 when Photon fails", async () => {
    photon.searchPlaces.mockRejectedValue(new Error("Photon answered 503"))
    const res = await search.GET(get("/api/geocode/search?q=Haworth"))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: "unavailable" })
  })

  it("allows each user 60 searches a minute", async () => {
    for (let i = 0; i < 60; i++)
      await search.GET(get("/api/geocode/search?q=Haworth"))
    const res = await search.GET(get("/api/geocode/search?q=Haworth"))
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBeTruthy()
  })
})

describe("GET /api/geocode/reverse", () => {
  it("is for signed-in users only", async () => {
    session.value = null
    const res = await reverse.GET(get("/api/geocode/reverse?lat=53.8&lng=-1.9"))
    expect(res.status).toBe(401)
  })

  it("needs a latitude and longitude in range", async () => {
    for (const qs of [
      "lat=91&lng=0",
      "lat=0&lng=181",
      "lat=abc&lng=0",
      "lat=0",
    ]) {
      const res = await reverse.GET(get(`/api/geocode/reverse?${qs}`))
      expect(res.status).toBe(400)
    }
    expect(photon.reversePlace).not.toHaveBeenCalled()
  })

  it("returns the nearest place", async () => {
    const res = await reverse.GET(
      get("/api/geocode/reverse?lat=53.8309287&lng=-1.9566318")
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: { id: "W2", label: "Haworth Churchyard" },
    })
    expect(photon.reversePlace).toHaveBeenCalledWith(53.8309287, -1.9566318)
  })

  it("answers 502 when Photon fails", async () => {
    photon.reversePlace.mockRejectedValue(new Error("timeout"))
    const res = await reverse.GET(get("/api/geocode/reverse?lat=1&lng=1"))
    expect(res.status).toBe(502)
  })

  it("allows each user 20 lookups a minute", async () => {
    for (let i = 0; i < 20; i++)
      await reverse.GET(get("/api/geocode/reverse?lat=1&lng=1"))
    const res = await reverse.GET(get("/api/geocode/reverse?lat=1&lng=1"))
    expect(res.status).toBe(429)
  })
})
