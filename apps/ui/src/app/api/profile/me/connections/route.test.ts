import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

const { getSession, listUserAccounts, unlinkAccount } = vi.hoisted(() => ({
  getSession: vi.fn(),
  listUserAccounts: vi.fn(),
  unlinkAccount: vi.fn(),
}))

vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession, listUserAccounts, unlinkAccount } },
}))

import { DELETE } from "./route"

function request(
  body: Record<string, unknown>,
  origin = "https://libraries.example"
) {
  return new Request("https://libraries.example/api/profile/me/connections", {
    method: "DELETE",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("connection removal after the auth upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("APP_PUBLIC_URL", "https://libraries.example")
    getSession.mockResolvedValue({ user: { id: "owner" } })
    listUserAccounts.mockResolvedValue([
      {
        id: "local-google-row",
        providerId: "google",
        accountId: "provider-subject",
      },
      { id: "password-row", providerId: "credential" },
    ])
    unlinkAccount.mockResolvedValue({ status: true })
  })
  afterEach(() => vi.unstubAllEnvs())

  it("resolves the local account ID through the signed-in user's accounts", async () => {
    const res = await DELETE(
      request({ providerId: "google", accountId: "another-user-row" })
    )
    expect(res.status).toBe(200)
    expect(unlinkAccount).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { accountId: "local-google-row" },
    })
  })

  it("refuses a provider absent from the signed-in user's accounts", async () => {
    const res = await DELETE(
      request({ providerId: "github", accountId: "another-user-row" })
    )
    expect(res.status).toBe(404)
    expect(unlinkAccount).not.toHaveBeenCalled()
  })

  it("keeps password credentials outside this connection removal route", async () => {
    const res = await DELETE(request({ providerId: "credential" }))
    expect(res.status).toBe(400)
    expect(listUserAccounts).not.toHaveBeenCalled()
    expect(unlinkAccount).not.toHaveBeenCalled()
  })

  it("requires a signed-in user", async () => {
    getSession.mockResolvedValue(null)
    const res = await DELETE(request({ providerId: "google" }))
    expect(res.status).toBe(401)
    expect(listUserAccounts).not.toHaveBeenCalled()
    expect(unlinkAccount).not.toHaveBeenCalled()
  })

  it("rejects a request from another origin before reading the session", async () => {
    const res = await DELETE(
      request({ providerId: "google" }, "https://attacker.example")
    )
    expect(res.status).toBe(403)
    expect(getSession).not.toHaveBeenCalled()
    expect(unlinkAccount).not.toHaveBeenCalled()
  })
})
