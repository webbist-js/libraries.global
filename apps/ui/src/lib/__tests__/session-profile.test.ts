import { SESSION_PROFILE_MAX_CLAIMS } from "@repo/access"
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

const claims = (n: number) => Array.from({ length: n }, (_, i) => `lib${i}`)

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

  it("shares one bridge request between concurrent calls", async () => {
    let release!: (r: Response) => void
    const f = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve
        })
    )
    vi.stubGlobal("fetch", f)

    const calls = [
      fetchSessionProfile("u1"),
      fetchSessionProfile("u1"),
      fetchSessionProfile("u1"),
    ]
    expect(f).toHaveBeenCalledTimes(1)
    release(Response.json(body))
    const results = await Promise.all(calls)
    expect(results.map((r) => r?.username)).toEqual(["ada", "ada", "ada"])
    expect(f).toHaveBeenCalledTimes(1)
  })

  it("does not join a request that an invalidate overtook", async () => {
    const releases: ((r: Response) => void)[] = []
    const release = (i: number, r: Response) => {
      const resolve = releases[i]
      if (!resolve) throw new Error(`bridge request ${i} was never made`)
      resolve(r)
    }
    const f = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          releases.push(resolve)
        })
    )
    vi.stubGlobal("fetch", f)

    const stale = fetchSessionProfile("u1")
    invalidateSessionProfile("u1")
    const fresh = fetchSessionProfile("u1")
    const joined = fetchSessionProfile("u1")
    expect(f).toHaveBeenCalledTimes(2)
    release(0, Response.json({ ...body, username: "stale" }))
    release(1, Response.json(body))
    expect((await stale)?.username).toBe("stale")
    expect((await fresh)?.username).toBe("ada")
    expect((await joined)?.username).toBe("ada")
    // Only the post-invalidate answer was cached.
    expect((await fetchSessionProfile("u1"))?.username).toBe("ada")
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("measures the TTL from when the bridge request started", async () => {
    let release!: (r: Response) => void
    const f = vi
      .fn<() => Promise<Response>>()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve
          })
      )
      .mockImplementation(async () => Response.json(body))
    vi.stubGlobal("fetch", f)

    const slow = fetchSessionProfile("u1")
    vi.advanceTimersByTime(SESSION_PROFILE_TTL_MS - 1000)
    release(Response.json(body))
    await slow
    // 1 s after the answer, but a full TTL after the read began: stale.
    vi.advanceTimersByTime(1001)
    await fetchSessionProfile("u1")
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

  it("rejects more claims than SESSION_PROFILE_MAX_CLAIMS", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(async () =>
          Response.json({ ...body, claims: claims(SESSION_PROFILE_MAX_CLAIMS) })
        )
        .mockImplementationOnce(async () =>
          Response.json({
            ...body,
            claims: claims(SESSION_PROFILE_MAX_CLAIMS + 1),
          })
        )
    )
    expect((await fetchSessionProfile("u1"))?.claims).toHaveLength(
      SESSION_PROFILE_MAX_CLAIMS
    )
    invalidateSessionProfile("u1")
    expect(await fetchSessionProfile("u1")).toBeNull()
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
