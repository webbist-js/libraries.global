import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  fetchSessionProfile,
  invalidateSessionProfile,
  SESSION_PROFILE_MAX_ENTRIES,
  SESSION_PROFILE_TTL_MS,
} from "../session-profile"

const body = {
  contributorRole: "contributor",
  username: "ada",
  tier: "Reader",
  claims: [],
}

const originalSecret = process.env.STRAPI_BRIDGE_SECRET

describe("fetchSessionProfile", () => {
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s"
    vi.useFakeTimers()
    invalidateSessionProfile("u1")
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    if (originalSecret === undefined) delete process.env.STRAPI_BRIDGE_SECRET
    else process.env.STRAPI_BRIDGE_SECRET = originalSecret
  })

  it("caches per user for the TTL, then refetches", async () => {
    const f = vi.fn(async () => Response.json(body))
    vi.stubGlobal("fetch", f)
    const expected = {
      contributorRole: "contributor",
      username: "ada",
      tier: "Reader",
      claims: [],
    }
    expect(await fetchSessionProfile("u1")).toEqual(expected)
    expect(await fetchSessionProfile("u1")).toEqual(expected)
    expect(f).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(SESSION_PROFILE_TTL_MS + 1)
    expect(await fetchSessionProfile("u1")).toEqual(expected)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("invalidate forces a refetch", async () => {
    const f = vi.fn(async () => Response.json(body))
    vi.stubGlobal("fetch", f)
    await fetchSessionProfile("u1")
    invalidateSessionProfile("u1")
    await fetchSessionProfile("u1")
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("does not cache a fetch that an invalidate overtook", async () => {
    let release!: (r: Response) => void
    const deferred = new Promise<Response>((resolve) => {
      release = resolve
    })
    const f = vi
      .fn<() => Promise<Response>>()
      .mockImplementationOnce(() => deferred)
      .mockImplementation(async () => Response.json(body))
    vi.stubGlobal("fetch", f)

    const inFlight = fetchSessionProfile("u1")
    invalidateSessionProfile("u1")
    release(Response.json({ ...body, username: "stale" }))
    expect((await inFlight)?.username).toBe("stale")

    expect((await fetchSessionProfile("u1"))?.username).toBe("ada")
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("coerces an unknown role to reader", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ...body, contributorRole: "overlord" }))
    )
    expect((await fetchSessionProfile("u1"))?.contributorRole).toBe("reader")
  })

  it("returns null, warns and caches nothing on failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const f = vi.fn(async () => new Response("no", { status: 500 }))
    vi.stubGlobal("fetch", f)
    expect(await fetchSessionProfile("u1")).toBeNull()
    await fetchSessionProfile("u1")
    expect(f).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/^\[session-profile\]/)
  })

  it("returns null and warns when fetch throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom")
      })
    )
    expect(await fetchSessionProfile("u1")).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("rejects a malformed body", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ contributorRole: 7, claims: "x" }))
    )
    expect(await fetchSessionProfile("u1")).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("returns null without a bridge secret", async () => {
    delete process.env.STRAPI_BRIDGE_SECRET
    const f = vi.fn()
    vi.stubGlobal("fetch", f)
    expect(await fetchSessionProfile("u1")).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it("evicts the oldest entry once the cap is reached", async () => {
    const f = vi.fn(async () => Response.json(body))
    vi.stubGlobal("fetch", f)
    await fetchSessionProfile("u1")
    for (let i = 0; i < SESSION_PROFILE_MAX_ENTRIES; i++) {
      await fetchSessionProfile(`cap-${i}`)
    }
    f.mockClear()
    await fetchSessionProfile("u1")
    expect(f).toHaveBeenCalledTimes(1)
    await fetchSessionProfile(`cap-${SESSION_PROFILE_MAX_ENTRIES - 1}`)
    expect(f).toHaveBeenCalledTimes(1)
  })
})
