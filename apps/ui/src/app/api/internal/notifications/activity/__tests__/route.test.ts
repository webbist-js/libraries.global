import { afterEach, beforeEach, expect, it, vi } from "vitest"

const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authDbPool: { query } }))
import { POST } from "../route"

const request = (body: unknown, secret = "fixture") =>
  new Request("http://localhost/api/internal/notifications/activity", {
    method: "POST",
    headers: { "x-service-secret": secret },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
  vi.stubEnv("INTERNAL_NOTIFICATIONS_ENABLED", "true")
  vi.stubEnv("INTERNAL_NOTIFICATIONS_SINCE", "2026-10-23T12:00:00Z")
  query.mockReset().mockResolvedValue({ rows: [] })
})
afterEach(() => vi.unstubAllEnvs())
it("requires service authentication before any database access", async () => {
  expect((await POST(request({ kind: "users" }, "wrong"))).status).toBe(401)
  expect(query).not.toHaveBeenCalled()
})
it("fails closed until explicitly activated", async () => {
  vi.stubEnv("INTERNAL_NOTIFICATIONS_ENABLED", "false")
  expect((await POST(request({ kind: "sessions" }))).status).toBe(503)
  expect(query).not.toHaveBeenCalled()
})
it("rejects unknown fields and nonnumeric cursors", async () => {
  expect(
    (await POST(request({ kind: "users", since: "1900-01-01" }))).status
  ).toBe(400)
  expect(
    (await POST(request({ kind: "sessions", after: "injection" }))).status
  ).toBe(400)
  expect(query).not.toHaveBeenCalled()
})
it("uses the server's activation date and excludes credentials and private client metadata", async () => {
  const response = await POST(request({ kind: "sessions", after: "42" }))
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining("internal_activity_events"),
    [new Date("2026-10-23T12:00:00Z"), "42", "sessions"]
  )
  const sql = query.mock.calls[0]![0]
  expect(sql).not.toMatch(/token|ipAddress|userAgent|email,/)
})
it("bounds feed pages and returns a stable cursor without skipping the extra row", async () => {
  query.mockResolvedValue({
    rows: Array.from({ length: 101 }, (_, i) => ({
      id: String(i + 1),
      userId: "owner",
      createdAt: "2026-10-23T12:00:00Z",
    })),
  })
  const body = await (await POST(request({ kind: "users" }))).json()
  expect(body.data).toHaveLength(100)
  expect(body.next).toBe("100")
})
