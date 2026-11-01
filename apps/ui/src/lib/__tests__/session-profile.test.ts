import { SESSION_PROFILE_MAX_CLAIMS } from "@repo/access"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buildSessionAccess } from "../session-access"
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
      compositionPreferences: { country: null, languages: [] },
      tier: "Reader",
      claims: [],
      staff: [],
      grants: [],
      roleGrants: [{ role: "contributor", queue: "all", locale: null }],
      verifications: [],
      earnedProUntil: null,
      rewardsPoints: 0,
      dismissedPrompts: [],
      teams: [],
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

  it("projects only valid owner country/language hints without losing grants to malformed preferences", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...body,
          country: "CO",
          languages: [
            { code: "es", proficiency: "native", privateNote: "omit" },
            null,
            { code: "fr", proficiency: "invalid" },
          ],
        })
      )
    )
    const profile = await fetchSessionProfile("u1")
    expect(profile?.compositionPreferences).toEqual({
      country: "CO",
      languages: [{ code: "es", proficiency: "native" }],
    })
    expect(profile?.roleGrants).toEqual([
      { role: "contributor", queue: "all", locale: null },
    ])
  })
  it("refreshes changed entitlements before the cache expires without a new login", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(Response.json(body))
      .mockResolvedValueOnce(
        Response.json({ ...body, grants: [{ plan: "pro", expiresAt: null }] })
      )
    vi.stubGlobal("fetch", f)
    expect(buildSessionAccess(await fetchSessionProfile("u1")).plan).toBe(
      "free"
    )
    const fresh = await fetchSessionProfile("u1", true)
    expect(buildSessionAccess(fresh).plan).toBe("pro")
    expect(f).toHaveBeenCalledTimes(2)
    expect(await fetchSessionProfile("u1")).toEqual(fresh)
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

  it("parses grants, verifications and earnedProUntil", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...body,
          grants: [{ plan: "pro", expiresAt: null }],
          verifications: [{ expiresAt: "2099-01-01T00:00:00Z" }],
          earnedProUntil: "2099-01-01T00:00:00Z",
        })
      )
    )
    const profile = await fetchSessionProfile("u1")
    expect(profile?.grants).toEqual([{ plan: "pro", expiresAt: null }])
    expect(profile?.verifications).toEqual([
      { expiresAt: "2099-01-01T00:00:00Z" },
    ])
    expect(profile?.earnedProUntil).toBe("2099-01-01T00:00:00Z")
  })

  it("carries Supporter through the bridge into the session without Pro permissions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...body,
          grants: [{ plan: "supporter", expiresAt: null }],
        })
      )
    )
    const profile = await fetchSessionProfile("u1")
    const access = buildSessionAccess(profile)
    expect(access.plan).toBe("supporter")
    expect(access.features).toEqual(["atlas.export", "library.history"])
    expect(access.features).not.toContain("atlas.compare")
    expect(access.limits.exportRows).toBe(500)
    expect(access.limits.savedViews).toBe(3)
    expect(access.capabilities).not.toContain("moderate.queue")
  })

  it("defaults grants, verifications and earnedProUntil when the bridge omits them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body))
    )
    const profile = await fetchSessionProfile("u1")
    expect(profile?.grants).toEqual([])
    expect(profile?.verifications).toEqual([])
    expect(profile?.earnedProUntil).toBeNull()
  })

  it("keeps only known dismissed prompts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...body,
          dismissedPrompts: ["find-contribute", "not-a-prompt", 7],
        })
      )
    )
    const profile = await fetchSessionProfile("u1")
    expect(profile?.dismissedPrompts).toEqual(["find-contribute"])
  })

  it("drops a grant with an unknown plan at parse time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...body,
          grants: [
            { plan: "pro", expiresAt: null },
            { plan: "enterprise", expiresAt: null },
          ],
        })
      )
    )
    const profile = await fetchSessionProfile("u1")
    expect(profile?.grants).toEqual([{ plan: "pro", expiresAt: null }])
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
  it("does not reuse previously granted Pro when a forced refresh fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ ...body, grants: [{ plan: "pro", expiresAt: null }] })
      )
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
    vi.stubGlobal("fetch", f)
    expect(buildSessionAccess(await fetchSessionProfile("u1")).plan).toBe("pro")
    const fresh = await fetchSessionProfile("u1", true)
    expect(fresh).toBeNull()
    expect(buildSessionAccess(fresh).plan).toBe("free")
    expect(f).toHaveBeenCalledTimes(2)
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

  it("parses role grants and drops unknown roles, queues and locales", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...body,
          roleGrants: [
            { role: "moderator", queue: "knowledge", locale: "fr" },
            { role: "overlord", queue: "all", locale: null },
            { role: "reader", queue: "all", locale: null },
            { role: "wiki_editor", queue: "galaxy", locale: null },
            { role: "wiki_editor", queue: "all", locale: 7 },
            null,
            { role: "journal_editor", queue: "all", locale: null },
          ],
        })
      )
    )
    expect((await fetchSessionProfile("u1"))?.roleGrants).toEqual([
      { role: "moderator", queue: "knowledge", locale: "fr" },
      { role: "journal_editor", queue: "all", locale: null },
    ])
  })

  it("keeps an empty roleGrants rather than falling back to the legacy role", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...body,
          contributorRole: "wiki_editor",
          roleGrants: [],
        })
      )
    )
    expect((await fetchSessionProfile("u1"))?.roleGrants).toEqual([])
  })

  it("falls back to the legacy role when a stale bridge omits roleGrants", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ ...body, contributorRole: "wiki_editor" })
      )
    )
    const profile = await fetchSessionProfile("u1")
    expect(profile?.roleGrants).toEqual([
      { role: "wiki_editor", queue: "all", locale: null },
    ])
    expect(buildSessionAccess(profile).capabilities).toContain(
      "docs.directEdit"
    )
  })

  it("rejects a body with more than 50 role grants", async () => {
    const many = Array.from({ length: 51 }, () => ({
      role: "contributor",
      queue: "all",
      locale: null,
    }))
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ...body, roleGrants: many }))
    )
    expect(await fetchSessionProfile("u1")).toBeNull()
  })

  it("keeps plan grants on grants, separate from role grants", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...body,
          grants: [{ plan: "pro", expiresAt: null }],
          roleGrants: [{ role: "contributor", queue: "all", locale: null }],
        })
      )
    )
    const p = await fetchSessionProfile("u1")
    expect(p?.grants).toEqual([{ plan: "pro", expiresAt: null }])
    expect(p?.roleGrants).toEqual([
      { role: "contributor", queue: "all", locale: null },
    ])
  })
})
