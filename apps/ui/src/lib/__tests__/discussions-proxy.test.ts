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
  it("forwards the reviewable-only filter on the moderation revision queue", async () => {
    mocks.session.mockResolvedValue({
      user: { id: "moderator", email: "moderator@example.test" },
    })
    mocks.fetch.mockResolvedValue(Response.json({ data: [], total: 0 }))
    const response = await proxyDiscussion(
      new Request(
        "https://example.test/api/discussions/moderation/revisions?limit=1&reviewableOnly=true"
      ),
      ["moderation", "revisions"]
    )
    expect(response.status).toBe(200)
    expect(String(mocks.fetch.mock.calls[0]?.[0])).toContain(
      "limit=1&reviewableOnly=true"
    )
  })

  it.each([
    "moderation/revisions?reviewableOnly=unknown",
    "threads?reviewableOnly=true",
  ])("rejects invalid reviewable filters: %s", async (path) => {
    mocks.session.mockResolvedValue({
      user: { id: "moderator", email: "moderator@example.test" },
    })
    const response = await proxyDiscussion(
      new Request("https://example.test/api/discussions/" + path),
      path.split("?")[0]!.split("/")
    )
    expect(response.status).toBe(400)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("forwards the inline conversation's chronological reply request", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ data: [], total: 0 }))
    const response = await proxyDiscussion(
      new Request(
        `https://example.test/api/discussions/threads/${id}/replies?limit=20&offset=0&order=chronological`
      ),
      ["threads", id, "replies"]
    )
    expect(response.status).toBe(200)
    expect(String(mocks.fetch.mock.calls[0]?.[0])).toContain(
      "limit=20&offset=0&order=chronological"
    )
  })
  it("rejects unknown reply ordering modes and ordering on unrelated routes", async () => {
    for (const [path, order] of [
      [`threads/${id}/replies`, "injected"],
      ["threads", "chronological"],
    ]) {
      const response = await proxyDiscussion(
        new Request(
          `https://example.test/api/discussions/${path}?order=${order}`
        ),
        path!.split("/")
      )
      expect(response.status).toBe(400)
    }
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it("allows only explicit image, reaction and restriction routes with bounded language/view/search queries", async () => {
    expect(
      discussionProxyPath("PUT", ["records", "reply", id, "reaction"])
    ).toBe(`records/reply/${id}/reaction`)
    expect(discussionProxyPath("POST", ["attachments"])).toBe("attachments")
    expect(discussionProxyPath("GET", ["attachments", id])).toBe(
      `attachments/${id}`
    )
    expect(
      discussionProxyPath("POST", [
        "moderation",
        "records",
        "thread",
        id,
        "sanctions",
      ])
    ).toBe(`moderation/records/thread/${id}/sanctions`)
    expect(discussionProxyPath("PUT", ["my", "sanctions", id, "appeal"])).toBe(
      `my/sanctions/${id}/appeal`
    )
    expect(discussionProxyPath("GET", ["attachments", ".."])).toBeNull()
    expect(
      (
        await proxyDiscussion(
          new Request(`https://example.test/api/discussions/my/status`),
          ["my", "status"]
        )
      ).status
    ).toBe(401)
    mocks.fetch.mockResolvedValue(Response.json({ data: [] }))
    const response = await proxyDiscussion(
      new Request(
        "https://example.test/api/discussions/threads?view=unanswered&language=es&q=library"
      ),
      ["threads"]
    )
    expect(response.status).toBe(200)
    expect(String(mocks.fetch.mock.calls[0]?.[0])).toContain(
      "view=unanswered&language=es&q=library"
    )
    const rejected = await proxyDiscussion(
      new Request(
        `https://example.test/api/discussions/threads?q=${"x".repeat(181)}`
      ),
      ["threads"]
    )
    expect(rejected.status).toBe(400)
  })

  it("forwards exactly one privately staged image with server identity and no public upload route", async () => {
    mocks.session.mockResolvedValue({
      user: { id: "writer", email: "writer@example.test" },
    })
    mocks.fetch.mockResolvedValue(Response.json({ id, mime: "image/webp" }))
    const form = new FormData()
    form.set(
      "file",
      new File([new Uint8Array([1, 2, 3])], "image.png", { type: "image/png" })
    )
    form.set("subjectId", id)
    form.set("altText", "A library reading room")
    form.set("caption", "After the workshop")
    const response = await proxyDiscussion(
      new Request("https://example.test/api/discussions/attachments", {
        method: "POST",
        headers: { Origin: "https://example.test" },
        body: form,
      }),
      ["attachments"]
    )
    expect(response.status).toBe(200)
    const [url, init] = mocks.fetch.mock.calls[0]!
    expect(String(url)).toContain("/api/discussions/attachments")
    expect(init.body).toBeInstanceOf(FormData)
    expect([...init.body.keys()]).toEqual([
      "file",
      "subjectId",
      "altText",
      "caption",
    ])
    expect(init.headers["X-Ba-User-Id"]).toBe("writer")
    expect(init.headers["Content-Type"]).toBeUndefined()
  })

  it("bounds actual multipart bytes and rejects duplicate/unknown fields before any upstream upload", async () => {
    mocks.session.mockResolvedValue({
      user: { id: "writer", email: "writer@example.test" },
    })
    const request = (form: FormData) =>
      new Request("https://example.test/api/discussions/attachments", {
        method: "POST",
        headers: { Origin: "https://example.test" },
        body: form,
      })
    const form = new FormData()
    form.set(
      "file",
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      })
    )
    form.set("subjectId", id)
    form.set("altText", "Image")
    expect((await proxyDiscussion(request(form), ["attachments"])).status).toBe(
      413
    )
    form.set("file", new File(["small"], "image.png", { type: "image/png" }))
    form.append(
      "file",
      new File(["small"], "image2.png", { type: "image/png" })
    )
    expect((await proxyDiscussion(request(form), ["attachments"])).status).toBe(
      400
    )
    form.delete("file")
    form.set("file", new File(["small"], "image.png", { type: "image/png" }))
    form.set("authorKey", "spoofed")
    expect((await proxyDiscussion(request(form), ["attachments"])).status).toBe(
      400
    )
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("retains image privacy and bytes while refusing non-image or oversized upstream payloads", async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "image/webp" },
      })
    )
    const req = () =>
      new Request(`https://example.test/api/discussions/attachments/${id}`)
    const response = await proxyDiscussion(req(), ["attachments", id])
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3])
    )
    mocks.fetch.mockResolvedValueOnce(
      new Response("<script>private()</script>", {
        headers: { "Content-Type": "image/svg+xml" },
      })
    )
    expect((await proxyDiscussion(req(), ["attachments", id])).status).toBe(503)
    mocks.fetch.mockResolvedValueOnce(
      new Response(new Uint8Array(4 * 1024 * 1024 + 1), {
        headers: { "Content-Type": "image/webp" },
      })
    )
    expect((await proxyDiscussion(req(), ["attachments", id])).status).toBe(503)
  })

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
