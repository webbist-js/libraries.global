import { beforeEach, describe, expect, it, vi } from "vitest"

const f = vi.hoisted(() => ({
  user: vi.fn(),
  team: vi.fn(),
  create: vi.fn(),
  change: vi.fn(),
  overage: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ authDbPool: {} }))
vi.mock("@/lib/billing/http", () => ({
  billingUser: f.user,
  billingJson: (data: unknown, status = 200) => Response.json(data, { status }),
  billingFailure: (error: { code: string; status: number }) =>
    Response.json({ error: error.code }, { status: error.status ?? 503 }),
}))
vi.mock("@/lib/team-api/store", () => ({
  createApiKey: f.create,
  changeApiKey: f.change,
}))
vi.mock("@/lib/team-api/team", () => ({ requireApiTeam: f.team }))
vi.mock("@/lib/team-api/billing", () => ({
  apiCheckout: vi.fn(),
  apiPortal: vi.fn(),
  setApiOverage: f.overage,
}))
vi.mock("@/lib/billing/provider", () => ({ billingStripe: vi.fn() }))
import { POST } from "./route"

const request = (body: unknown) =>
  new Request(
    "https://libraries.global/api/staff/team/team000000000000000001/api",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
const params = () => ({
  params: Promise.resolve({ teamId: "team000000000000000001" }),
})
const create = {
  action: "create",
  name: "Integration",
  scopes: ["libraries:read"],
  expiresAt: null,
}
beforeEach(() => {
  vi.resetAllMocks()
  f.user.mockResolvedValue({ id: "organiser" })
  f.team.mockResolvedValue({ id: "team000000000000000001" })
  f.create.mockResolvedValue({
    id: "key",
    secret: "server-generated-credential",
  })
})
describe("Team key generation contract", () => {
  it.each(["secret", "password", "token"])(
    "rejects a client-chosen %s on creation",
    async (field) => {
      const response = await POST(
        request({ ...create, [field]: "client-chosen-value" }),
        params()
      )
      expect(response.status).toBe(400)
      expect(f.create).not.toHaveBeenCalled()
      expect(f.team).not.toHaveBeenCalled()
    }
  )
  it("rejects a client-chosen replacement secret on regeneration", async () => {
    const response = await POST(
      request({
        action: "rotate",
        keyId: "f860fb39-311b-4e26-a2de-971901fa0354",
        secret: "client-chosen-value",
      }),
      params()
    )
    expect(response.status).toBe(400)
    expect(f.change).not.toHaveBeenCalled()
  })
  it("accepts only key metadata and uses the authenticated mutation path", async () => {
    const req = request(create)
    const response = await POST(req, params())
    expect(response.status).toBe(201)
    expect(f.user).toHaveBeenCalledWith(req, true, true)
    expect(f.create).toHaveBeenCalledWith(
      {},
      "team000000000000000001",
      "organiser",
      { name: "Integration", expiresAt: null, scopes: ["libraries:read"] }
    )
  })
  it("defaults new keys to read scopes and requires confirmation for write or analysis", async () => {
    await POST(request({ ...create, scopes: undefined }), params())
    expect(f.create.mock.calls[0]?.[3].scopes).toEqual([
      "search:read",
      "libraries:read",
      "services:read",
    ])
    const refused = await POST(
      request({ ...create, scopes: ["analysis:run"] }),
      params()
    )
    expect(refused.status).toBe(400)
    expect((await refused.json()).error).toBe("api_scope_confirmation_required")
    const confirmed = await POST(
      request({
        ...create,
        scopes: ["submissions:write"],
        confirmScopes: true,
      }),
      params()
    )
    expect(confirmed.status).toBe(201)
    expect(f.create.mock.calls.at(-1)?.[3].scopes).toEqual([
      "submissions:write",
    ])
  })
})

describe("overage controls", () => {
  it("never enables overage without an explicit confirmation, cap and terms", async () => {
    for (const body of [
      {
        action: "overage",
        enabled: true,
        capPence: 10000,
        termsVersion: "2.0",
      },
      { action: "overage", enabled: true, confirm: true, termsVersion: "2.0" },
      { action: "overage", enabled: false, capPence: 10000 },
    ]) {
      const response = await POST(request(body), params())
      expect(response.status).toBe(400)
    }
    expect(f.overage).not.toHaveBeenCalled()
  })
  it("passes an organiser's confirmed opt-in with a fresh session and allows opting out", async () => {
    f.overage.mockResolvedValue({ enabled: true, capPence: 10000, revision: 1 })
    const req = request({
      action: "overage",
      enabled: true,
      capPence: 10000,
      termsVersion: "2.0",
      confirm: true,
    })
    expect((await POST(req, params())).status).toBe(200)
    expect(f.user).toHaveBeenCalledWith(req, true, true)
    expect(f.overage.mock.calls[0]?.[4]).toEqual({
      enabled: true,
      capPence: 10000,
      termsVersion: "2.0",
    })
    const off = request({ action: "overage", enabled: false })
    expect((await POST(off, params())).status).toBe(200)
    expect(f.user).toHaveBeenLastCalledWith(off, true, false)
    expect(f.overage.mock.calls[1]?.[4]).toEqual({ enabled: false })
  })
})
