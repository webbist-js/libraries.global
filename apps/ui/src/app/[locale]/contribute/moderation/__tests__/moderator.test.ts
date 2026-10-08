import { beforeEach, describe, expect, it, vi } from "vitest"

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})
const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND")
})
const getSessionSSR = vi.fn()

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  notFound: () => notFound(),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: (...args: unknown[]) => getSessionSSR(...args),
}))

const { moderatorAccess, requireModerator } =
  await import("../_components/moderator")

const SCOPES = [{ queue: "index", locale: null }]
const moderator = {
  id: "u1",
  profileLoaded: true,
  capabilities: ["moderate.queue"],
  moderationScopes: SCOPES,
}

beforeEach(() => {
  redirect.mockClear()
  notFound.mockClear()
})

describe("moderatorAccess", () => {
  it("is ok with moderate.queue", () => {
    expect(moderatorAccess(moderator)).toBe("ok")
  })

  it("is denied for a loaded session without it, and for no access fields", () => {
    expect(
      moderatorAccess({ profileLoaded: true, capabilities: ["submit"] })
    ).toBe("denied")
    expect(moderatorAccess({})).toBe("denied")
    expect(moderatorAccess(null)).toBe("denied")
  })

  it("is unknown only when the profile explicitly failed to load", () => {
    expect(moderatorAccess({ profileLoaded: false, capabilities: [] })).toBe(
      "unknown"
    )
    expect(moderatorAccess({ profileLoaded: false })).toBe("unknown")
  })
})

describe("requireModerator", () => {
  it("sends a signed-out viewer to sign in", async () => {
    getSessionSSR.mockResolvedValue(null)
    await expect(requireModerator("/contribute/moderation")).rejects.toThrow(
      "REDIRECT:/auth/signin?callbackUrl=%2Fcontribute%2Fmoderation"
    )
  })

  it("404s a loaded session without moderate.queue", async () => {
    getSessionSSR.mockResolvedValue({
      user: { id: "u1", profileLoaded: true, capabilities: [] },
    })
    await expect(requireModerator("/contribute/moderation")).rejects.toThrow(
      "NOT_FOUND"
    )
  })

  it("does not 404 when the session profile failed to load", async () => {
    getSessionSSR.mockResolvedValue({
      user: { id: "u1", profileLoaded: false, capabilities: [] },
    })
    const gate = await requireModerator("/contribute/moderation")
    expect(notFound).not.toHaveBeenCalled()
    expect(gate.accessUnknown).toBe(true)
    expect(gate.scopes).toEqual([])
  })

  it("returns the Moderator and their scopes", async () => {
    getSessionSSR.mockResolvedValue({ user: moderator })
    const gate = await requireModerator("/contribute/moderation")
    expect(gate.accessUnknown).toBe(false)
    expect(gate.scopes).toEqual(SCOPES)
    expect(gate.user.id).toBe("u1")
  })
})
