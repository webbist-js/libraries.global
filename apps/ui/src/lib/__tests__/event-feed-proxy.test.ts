import { beforeEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({ user: null as any }))
vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("../auth", () => ({
  auth: {
    api: {
      getSession: async () => (session.user ? { user: session.user } : null),
    },
  },
}))

import { proxyEventFeed } from "../event-feed-proxy"

const LIB = "lib00000000000000000001"
const librarian = {
  id: "u1",
  email: "u@x.org",
  name: "U",
  capabilities: ["events.feed"],
  claimedLibraryIds: [LIB],
}
const req = (body?: unknown) =>
  new Request("http://localhost/api/contribute/event-feeds", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  })

beforeEach(() => {
  process.env.STRAPI_BRIDGE_SECRET = "bridge"
  session.user = librarian
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ data: { ok: true } }, { status: 200 }))
  )
})

describe("proxyEventFeed", () => {
  it("401 without a session, 403 without events.feed", async () => {
    session.user = null
    expect(
      (
        await proxyEventFeed(req({}), {
          method: "POST",
          path: "feeds",
          kind: "write",
        })
      ).status
    ).toBe(401)
    session.user = { ...librarian, capabilities: [] }
    expect(
      (
        await proxyEventFeed(req({}), {
          method: "POST",
          path: "feeds",
          kind: "write",
        })
      ).status
    ).toBe(403)
  })

  it("403 for a library outside the session's claims", async () => {
    const r = await proxyEventFeed(
      req({
        libraryDocumentId: "lib00000000000000000099",
        provider: "ical",
        values: { feedUrl: "https://x.example/a.ics" },
      }),
      {
        method: "POST",
        path: "feeds",
        kind: "write",
        libraryFromBody: true,
        validateValues: "body",
      }
    )
    expect(r.status).toBe(403)
  })

  it("400 for values the registry rejects, before calling Strapi", async () => {
    const r = await proxyEventFeed(
      req({
        libraryDocumentId: LIB,
        provider: "ical",
        values: { feedUrl: "nope" },
      }),
      {
        method: "POST",
        path: "feeds",
        kind: "write",
        libraryFromBody: true,
        validateValues: "body",
      }
    )
    expect(r.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("forwards only allowed keys with bridge headers and no-store", async () => {
    const r = await proxyEventFeed(
      req({
        libraryDocumentId: LIB,
        provider: "ical",
        values: { feedUrl: "https://x.example/a.ics" },
        sneaky: 1,
      }),
      {
        method: "POST",
        path: "feeds",
        kind: "write",
        libraryFromBody: true,
        validateValues: "body",
      }
    )
    expect(r.status).toBe(200)
    expect(r.headers.get("Cache-Control")).toBe("no-store")
    const [url, init] = (fetch as any).mock.calls[0]
    expect(url).toMatch(/\/api\/events\/feeds$/)
    expect(JSON.parse(init.body)).toEqual({
      libraryDocumentId: LIB,
      provider: "ical",
      values: { feedUrl: "https://x.example/a.ics" },
    })
    expect(init.headers["X-Ba-User-Id"]).toBe("u1")
  })

  it("rate-limits writes at 10 an hour per user", async () => {
    let last: Response | null = null
    for (let i = 0; i < 11; i++)
      last = await proxyEventFeed(
        new Request("http://localhost", { method: "POST" }),
        {
          method: "POST",
          path: "feeds/aaaaaaaaaaaaaaaaaaaaaaaa/pause",
          kind: "write",
        }
      )
    expect(last!.status).toBe(429)
  })
})
