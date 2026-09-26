import { beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const listSessions = vi.fn()
const revokeSession = vi.fn()
const revokeOtherSessions = vi.fn()

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession,
      listSessions,
      revokeSession,
      revokeOtherSessions,
    },
  },
}))

const { DELETE, GET } = await import("./route")

describe("GET /api/profile/me/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    getSession.mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
  })

  it("never leaks the bearer token, and flags the current session", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } })
    listSessions.mockResolvedValue([
      {
        id: "s1",
        token: "secret-1",
        userAgent: "UA1",
        ipAddress: "203.0.113.1",
        createdAt: "2024-01-01",
        expiresAt: "2024-02-01",
      },
      {
        id: "s2",
        token: "secret-2",
        userAgent: "UA2",
        ipAddress: "203.0.113.2",
        createdAt: "2024-01-02",
        expiresAt: "2024-02-02",
      },
    ])

    const res = await GET()
    const json = (await res.json()) as { data: Record<string, unknown>[] }

    expect(json.data).toHaveLength(2)
    for (const entry of json.data) {
      expect(entry).not.toHaveProperty("token")
    }
    expect(json.data.find((s) => s.id === "s1")?.current).toBe(true)
    expect(json.data.find((s) => s.id === "s2")?.current).toBe(false)
  })
})

describe("DELETE /api/profile/me/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    getSession.mockResolvedValue(null)
    const req = new Request("http://localhost/api/profile/me/sessions", {
      method: "DELETE",
      body: JSON.stringify({ id: "s2" }),
    })

    const res = await DELETE(req)

    expect(res.status).toBe(401)
  })

  it("resolves id to a token server-side and revokes by token", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } })
    listSessions.mockResolvedValue([
      { id: "s1", token: "secret-1" },
      { id: "s2", token: "secret-2" },
    ])
    const req = new Request("http://localhost/api/profile/me/sessions", {
      method: "DELETE",
      body: JSON.stringify({ id: "s2" }),
    })

    const res = await DELETE(req)

    expect(revokeSession).toHaveBeenCalledWith(
      expect.objectContaining({ body: { token: "secret-2" } })
    )
    expect(revokeOtherSessions).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
  })

  it("404s for an unknown id without revoking anything", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } })
    listSessions.mockResolvedValue([{ id: "s1", token: "secret-1" }])
    const req = new Request("http://localhost/api/profile/me/sessions", {
      method: "DELETE",
      body: JSON.stringify({ id: "unknown" }),
    })

    const res = await DELETE(req)

    expect(res.status).toBe(404)
    expect(revokeSession).not.toHaveBeenCalled()
  })

  it("revokes other sessions when no id is given", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } })
    const req = new Request("http://localhost/api/profile/me/sessions", {
      method: "DELETE",
      body: JSON.stringify({}),
    })

    const res = await DELETE(req)

    expect(revokeOtherSessions).toHaveBeenCalled()
    expect(revokeSession).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
  })
})
