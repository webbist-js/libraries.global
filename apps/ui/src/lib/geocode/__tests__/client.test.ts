import { beforeEach, describe, expect, it, vi } from "vitest"

import { findPlaces, placeNear } from "../client"

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

describe("findPlaces", () => {
  it("asks the proxy and returns its places", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ id: "W1" }] }))
    const signal = new AbortController().signal
    expect(await findPlaces("British Library", signal)).toEqual([{ id: "W1" }])
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/geocode/search?q=British%20Library",
      { signal }
    )
  })

  it("throws when the proxy refuses", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 502 }))
    await expect(findPlaces("Haworth")).rejects.toThrow()
  })
})

describe("placeNear", () => {
  it("asks the proxy for the nearest place", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: { id: "W2" } }))
    expect(await placeNear(53.83, -1.95)).toEqual({ id: "W2" })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/geocode/reverse?lat=53.83&lng=-1.95"
    )
  })

  it("is null when the lookup fails", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 429 }))
    expect(await placeNear(0, 0)).toBeNull()
    fetchMock.mockRejectedValue(new TypeError("offline"))
    expect(await placeNear(0, 0)).toBeNull()
  })
})
