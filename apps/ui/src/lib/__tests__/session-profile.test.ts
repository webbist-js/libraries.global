import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  fetchSessionProfile,
  invalidateSessionProfile,
  SESSION_PROFILE_TTL_MS,
} from "../session-profile"

const body = {
  contributorRole: "contributor",
  username: "ada",
  tier: "Reader",
  claims: [],
}

describe("fetchSessionProfile", () => {
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s"
    vi.useFakeTimers()
    invalidateSessionProfile("u1")
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("caches per user for the TTL, then refetches", async () => {
    const f = vi.fn(async () => Response.json(body))
    vi.stubGlobal("fetch", f)
    await fetchSessionProfile("u1")
    await fetchSessionProfile("u1")
    expect(f).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(SESSION_PROFILE_TTL_MS + 1)
    await fetchSessionProfile("u1")
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

  it("returns null and caches nothing on failure", async () => {
    const f = vi.fn(async () => new Response("no", { status: 500 }))
    vi.stubGlobal("fetch", f)
    expect(await fetchSessionProfile("u1")).toBeNull()
    await fetchSessionProfile("u1")
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("rejects a malformed body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ contributorRole: 7, claims: "x" }))
    )
    expect(await fetchSessionProfile("u1")).toBeNull()
  })

  it("returns null without a bridge secret", async () => {
    delete process.env.STRAPI_BRIDGE_SECRET
    const f = vi.fn()
    vi.stubGlobal("fetch", f)
    expect(await fetchSessionProfile("u1")).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })
})
