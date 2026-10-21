import { beforeEach, describe, expect, it, vi } from "vitest"

const f = vi.hoisted(() => ({
  user: vi.fn(),
  team: vi.fn(),
  checkout: vi.fn(),
  portal: vi.fn(),
  refresh: vi.fn(),
  discard: vi.fn(),
  dashboard: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ authDbPool: {} }))
vi.mock("@/lib/billing/http", () => ({
  billingUser: f.user,
  billingJson: (body: unknown, status = 200) => Response.json(body, { status }),
  billingFailure: (error: { code: string; status?: number }) =>
    Response.json({ error: error.code }, { status: error.status ?? 503 }),
}))
vi.mock("@/lib/team-api/team", () => ({ requireApiTeam: f.team }))
vi.mock("@/lib/billing/provider", () => ({ billingStripe: () => ({}) }))
vi.mock("@/lib/team-billing/billing", () => ({
  teamCheckout: f.checkout,
  teamPortal: f.portal,
}))
vi.mock("@/lib/team-billing/manage", () => ({
  refreshOwnedTeam: f.refresh,
  discardTeam: f.discard,
}))
vi.mock("@/lib/team-billing/dashboard", () => ({
  teamBillingDashboard: f.dashboard,
}))
import { POST, GET } from "./route"

const request = (body: unknown) =>
  new Request(
    "https://libraries.example/api/staff/team/team00000000000000000001/billing",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
const params = () => ({
  params: Promise.resolve({ teamId: "team00000000000000000001" }),
})
beforeEach(() => {
  vi.resetAllMocks()
  f.user.mockResolvedValue({ id: "owner", email: "owner@example.invalid" })
  f.team.mockResolvedValue({ documentId: "team00000000000000000001" })
  f.checkout.mockResolvedValue({ url: "https://checkout.stripe.com/fixture" })
  f.dashboard.mockResolvedValue({ membership: null })
})
describe("Team billing boundary", () => {
  it.each([
    "priceId",
    "discounted",
    "customerId",
    "organiser",
    "verifiedAt",
    "paidThrough",
  ])("rejects browser-selected %s", async (field) => {
    const response = await POST(
      request({
        action: "checkout",
        seats: 5,
        locale: "en",
        termsVersion: "1.2",
        [field]: "chosen",
      }),
      params()
    )
    expect(response.status).toBe(400)
    expect(f.checkout).not.toHaveBeenCalled()
  })
  it("requires a current organiser and allows renewal management on an inactive Team", async () => {
    const req = request({
      action: "checkout",
      seats: 5,
      locale: "en",
      termsVersion: "1.2",
    })
    expect((await POST(req, params())).status).toBe(200)
    expect(f.user).toHaveBeenCalledWith(req, true)
    expect(f.team).toHaveBeenCalledWith(
      "team00000000000000000001",
      { id: "owner", email: "owner@example.invalid" },
      true,
      false
    )
    f.team.mockRejectedValueOnce({ code: "organiser_required", status: 403 })
    expect(
      (await POST(request({ action: "portal", locale: "en" }), params())).status
    ).toBe(403)
    expect(f.portal).not.toHaveBeenCalled()
  })
  it.each([0, 4, 501, 5.5, "5"])(
    "rejects invalid seat count %s",
    async (seats) => {
      expect(
        (
          await POST(
            request({
              action: "checkout",
              seats,
              locale: "en",
              termsVersion: "1.2",
            }),
            params()
          )
        ).status
      ).toBe(400)
      expect(f.checkout).not.toHaveBeenCalled()
    }
  )
  it("permits usage inspection by members but performs no provider write", async () => {
    const req = new Request(
      "https://libraries.example/api/staff/team/team00000000000000000001/billing"
    )
    expect((await GET(req, params())).status).toBe(200)
    expect(f.team).toHaveBeenCalledWith(
      "team00000000000000000001",
      expect.any(Object)
    )
    expect(f.checkout).not.toHaveBeenCalled()
    expect(f.portal).not.toHaveBeenCalled()
  })
})
