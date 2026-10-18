import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
  stats: vi.fn(),
  discussions: vi.fn(),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => (state.user ? { user: state.user } : null),
}))
vi.mock("@/lib/moderation-proxy", () => ({ fetchModeration: state.stats }))
vi.mock("@/lib/moderation-work-counts", () => ({
  fetchDiscussionReviewCount: state.discussions,
}))

const { GET } = await import("../route")

beforeEach(() => {
  vi.clearAllMocks()
  state.user = {
    id: "reviewer",
    email: "reviewer@example.test",
    capabilities: ["moderate.queue"],
    moderationScopes: [{ queue: "all", locale: null }],
  }
  state.stats.mockResolvedValue({
    status: 200,
    body: {
      data: [
        { category: "libraries", status: "pending", count: 1 },
        { category: "articles", status: "pending", count: 0 },
        { category: "claims", status: "pending", count: 0 },
        { category: "drives", status: "pending", count: 0 },
        { category: "applications", status: "pending", count: 0 },
      ],
    },
  })
  state.discussions.mockResolvedValue(2)
})

describe("moderation drawer summary", () => {
  it.each([null, { id: "reader", capabilities: [] }])(
    "denies callers without moderation access before fetching counts",
    async (user) => {
      state.user = user
      const response = await GET()
      expect([401, 403]).toContain(response.status)
      expect(state.stats).not.toHaveBeenCalled()
      expect(state.discussions).not.toHaveBeenCalled()
    }
  )

  it("returns counts for each permitted category, including discussions, without caching private data", async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(await response.json()).toEqual({
      data: [
        { id: "libraries", pending: 1 },
        { id: "articles", pending: 0 },
        { id: "claims", pending: 0 },
        { id: "drives", pending: 0 },
        { id: "applications", pending: 0 },
        { id: "discussions", pending: 2 },
      ],
    })
    expect(state.stats).toHaveBeenCalledWith(state.user, "stats?group=category")
    expect(state.discussions).toHaveBeenCalledWith(state.user)
  })

  it("does not query or expose submission categories to a discussions-only moderator", async () => {
    state.user!.moderationScopes = [{ queue: "discussions", locale: "fr" }]
    expect(await (await GET()).json()).toEqual({
      data: [{ id: "discussions", pending: 2 }],
    })
    expect(state.stats).not.toHaveBeenCalled()
  })

  it("keeps knowledge reviewers within Articles, even if upstream returned other categories", async () => {
    state.user!.moderationScopes = [{ queue: "knowledge", locale: "cs" }]
    expect(await (await GET()).json()).toEqual({
      data: [{ id: "articles", pending: 0 }],
    })
    expect(state.discussions).not.toHaveBeenCalled()
  })

  it("preserves unknown counts on partial failure, rather than claiming an empty queue", async () => {
    state.stats.mockResolvedValue({ status: 502, body: null })
    const body = await (await GET()).json()
    expect(
      body.data.find((row: { id: string }) => row.id === "libraries").pending
    ).toBeNull()
    expect(
      body.data.find((row: { id: string }) => row.id === "discussions").pending
    ).toBe(2)
  })
})
