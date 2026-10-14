import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createBetaPass } from "../access"
import { hasBetaAccess, redeemBetaInvitation } from "../invitations"

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("BETA_ACCESS_SECRET", "s".repeat(32))
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge-secret")
  vi.stubEnv("STRAPI_URL", "http://cms.test")
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
const pass = () =>
  createBetaPass({
    invitationId: "i".repeat(24),
    expiresAt: Date.now() + 86400000,
  })
describe("revocable beta access", () => {
  it("checks the CMS on every use so a signed cookie stops working after revocation", async () => {
    const cookie = pass()
    fetchMock
      .mockResolvedValueOnce(Response.json({ valid: true }))
      .mockResolvedValueOnce(Response.json({ valid: false }))
    expect(await hasBetaAccess(cookie)).toBe(true)
    expect(await hasBetaAccess(cookie)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      cache: "no-store",
      headers: { "X-Service-Secret": "bridge-secret" },
    })
  })
  it("fails closed on a CMS outage and rejects legacy/forged cookies without a request", async () => {
    fetchMock.mockRejectedValue(new Error("offline"))
    expect(await hasBetaAccess(pass())).toBe(false)
    fetchMock.mockClear()
    expect(await hasBetaAccess("legacy-cookie")).toBe(false)
    expect(await hasBetaAccess(undefined)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("does not treat infrastructure failures as an invalid invitation", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
    expect(await redeemBetaInvitation("a".repeat(43))).toBeNull()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
    await expect(redeemBetaInvitation("a".repeat(43))).rejects.toThrow(
      "unavailable"
    )
  })
})
