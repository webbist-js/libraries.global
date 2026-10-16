import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }))
import { discussionProxyPath, proxyDiscussion } from "../discussions-proxy"

const id = "thread000000000000000001"
beforeEach(() => {
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "trusted-secret")
  vi.stubEnv("APP_PUBLIC_URL", "https://example.test")
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.fetch.mockReset()
  mocks.session.mockResolvedValue(null)
})
describe("discussion gateway", () => {
  it("allows only documented content routes and prevents traversal", () => {
    const uuid = "385a866e-f44c-49a9-ae0c-a73089b5af70"
    expect(discussionProxyPath("GET", ["threads", uuid])).toBe(
      `threads/${uuid}`
    )
    expect(discussionProxyPath("POST", ["threads", uuid, "replies"])).toBe(
      `threads/${uuid}/replies`
    )
    expect(discussionProxyPath("PUT", ["moderation", "revisions", uuid])).toBe(
      `moderation/revisions/${uuid}`
    )
    expect(discussionProxyPath("PUT", ["threads", uuid, "subscription"])).toBe(
      `threads/${uuid}/subscription`
    )
    expect(discussionProxyPath("PUT", ["moderation", "revisions", id])).toBe(
      `moderation/revisions/${id}`
    )
    expect(discussionProxyPath("POST", ["..", "admin", "subjects"])).toBeNull()
    expect(discussionProxyPath("POST", ["subjects"])).toBeNull()
    expect(discussionProxyPath("GET", ["threads", "%2e%2e"])).toBeNull()
  })
  it("does not forward incoming spoofed identity or authorization headers", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ data: [] }))
    await proxyDiscussion(
      new Request("https://example.test/api/discussions/threads", {
        headers: { "X-Ba-User-Id": "forged", Authorization: "Bearer forged" },
      }),
      ["threads"]
    )
    const init = mocks.fetch.mock.calls[0]![1]
    expect(init.headers).toEqual({ "X-Service-Secret": "trusted-secret" })
    expect(init.cache).toBe("no-store")
  })
  it("requires an authenticated author and rejects cross-site writes", async () => {
    const req = () =>
      new Request("https://example.test/api/discussions/threads", {
        method: "POST",
        headers: { Origin: "https://other.test" },
        body: "{}",
      })
    expect((await proxyDiscussion(req(), ["threads"])).status).toBe(401)
    mocks.session.mockResolvedValue({
      user: { id: "writer", email: "writer@example.test" },
    })
    expect((await proxyDiscussion(req(), ["threads"])).status).toBe(403)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it("preserves conflict responses and uses server session identity for writes", async () => {
    mocks.session.mockResolvedValue({
      user: { id: "writer", email: "writer@example.test", name: "Writer" },
    })
    mocks.fetch.mockResolvedValue(
      Response.json({ error: "Stale revision" }, { status: 409 })
    )
    const response = await proxyDiscussion(
      new Request("https://example.test/api/discussions/threads", {
        method: "POST",
        headers: { Origin: "https://example.test" },
        body: JSON.stringify({ title: "Story", body: "Text" }),
      }),
      ["threads"]
    )
    expect(response.status).toBe(409)
    expect(mocks.fetch.mock.calls[0]![1].headers["X-Ba-User-Id"]).toBe("writer")
    expect(response.headers.get("cache-control")).toContain("no-store")
  })
  it("caps actual streamed bytes even without Content-Length", async () => {
    mocks.session.mockResolvedValue({
      user: { id: "writer", email: "writer@example.test" },
    })
    const response = await proxyDiscussion(
      new Request("https://example.test/api/discussions/threads", {
        method: "POST",
        headers: { Origin: "https://example.test" },
        body: JSON.stringify({ body: "x".repeat(100 * 1024) }),
      }),
      ["threads"]
    )
    expect(response.status).toBe(413)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
