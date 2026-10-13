import { beforeEach, describe, expect, it, vi } from "vitest"

const f = vi.hoisted(() => ({ session: vi.fn(), query: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authDbPool: { query: f.query } }))
vi.mock("@/lib/auth-server", () => ({ getSessionSSR: f.session }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
import { billingUser } from "../http"

const request = (origin?: string) =>
  new Request("https://libraries.global/api/billing/portal", {
    method: "POST",
    headers: origin ? { Origin: origin } : {},
  })
beforeEach(() => {
  vi.stubEnv("APP_PUBLIC_URL", "https://libraries.global")
  f.session.mockResolvedValue({ user: { id: "owner", emailVerified: true } })
  f.query.mockResolvedValue({ rows: [{ hits: 1 }] })
  vi.clearAllMocks()
})
describe("billing session and mutation guards", () => {
  it.each([
    undefined,
    "https://attacker.example",
    "https://libraries.global.attacker.example",
  ])("refuses an invalid origin %s before reading identity", async (origin) => {
    await expect(billingUser(request(origin), true)).rejects.toMatchObject({
      status: 403,
    })
    expect(f.session).not.toHaveBeenCalled()
  })
  it("requires a verified session", async () => {
    f.session.mockResolvedValueOnce(null)
    await expect(billingUser(request(), false)).rejects.toMatchObject({
      status: 401,
    })
    f.session.mockResolvedValueOnce({
      user: { id: "owner", emailVerified: false },
    })
    await expect(billingUser(request(), false)).rejects.toMatchObject({
      status: 403,
    })
    expect(f.query).not.toHaveBeenCalled()
  })
  it("limits writes atomically per authenticated owner", async () => {
    f.query.mockResolvedValueOnce({ rows: [{ hits: 11 }] })
    await expect(
      billingUser(request("https://libraries.global"), true)
    ).rejects.toMatchObject({ status: 429 })
    expect(f.query.mock.calls[0]?.[1]).toEqual(["write:owner"])
  })
})
