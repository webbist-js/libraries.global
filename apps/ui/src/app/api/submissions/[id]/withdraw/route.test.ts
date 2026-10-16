import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }))
import { POST } from "./route"

const ID = "abcdefghijklmnopqrstuvwx"
const context = { params: Promise.resolve({ id: ID }) }
const req = (body: unknown, origin = "http://localhost:3000") =>
  new Request(`http://localhost:3000/api/submissions/${ID}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("APP_PUBLIC_URL", "http://localhost:3000")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-secret")
  vi.stubEnv("STRAPI_URL", "http://cms.test")
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.session.mockResolvedValue({
    user: { id: "writer", email: "writer@example.test" },
  })
  mocks.fetch.mockResolvedValue(
    Response.json({ data: { documentId: ID, status: "draft" } })
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("article withdrawal proxy", () => {
  it("forwards only a typed CAS token with the signed-in writer's identity", async () => {
    const time = "2026-10-16T10:00:00.000Z"
    const response = await POST(req({ baseUpdatedAt: time }), context)
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(JSON.parse(mocks.fetch.mock.calls[0]![1].body)).toEqual({
      baseUpdatedAt: time,
    })
    expect(mocks.fetch.mock.calls[0]![1].headers["X-Ba-User-Id"]).toBe("writer")
  })
  it("rejects foreign origin, supplied identities and invalid timestamps before sending a write", async () => {
    expect(
      (
        await POST(
          req(
            { baseUpdatedAt: "2026-10-16T10:00:00Z" },
            "https://foreign.test"
          ),
          context
        )
      ).status
    ).toBe(403)
    expect(
      (
        await POST(
          req({ baseUpdatedAt: "2026-10-16T10:00:00Z", baUserId: "other" }),
          context
        )
      ).status
    ).toBe(400)
    expect(
      (await POST(req({ baseUpdatedAt: "yesterday" }), context)).status
    ).toBe(400)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it("preserves conflict responses and never claims success after an unknown network outcome", async () => {
    mocks.fetch.mockResolvedValue(
      Response.json({ error: "Changed" }, { status: 409 })
    )
    expect(
      (await POST(req({ baseUpdatedAt: "2026-10-16T10:00:00Z" }), context))
        .status
    ).toBe(409)
    mocks.fetch.mockRejectedValue(new Error("timeout"))
    expect(
      (await POST(req({ baseUpdatedAt: "2026-10-16T10:00:00Z" }), context))
        .status
    ).toBe(503)
  })
})
