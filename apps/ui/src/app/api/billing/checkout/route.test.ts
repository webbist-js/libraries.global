import { beforeEach, describe, expect, it, vi } from "vitest"

const f = vi.hoisted(() => ({
  user: vi.fn(),
  checkout: vi.fn(),
  stripe: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ authDbPool: {} }))
vi.mock("@/lib/billing/http", () => {
  return {
    billingUser: f.user,
    billingJson: (data: unknown) => Response.json(data),
    billingFailure: (e: { code: string; status: number }) =>
      Response.json({ error: e.code }, { status: e.status ?? 503 }),
  }
})
vi.mock("@/lib/billing/checkout", () => ({ createManagedCheckout: f.checkout }))
vi.mock("@/lib/billing/provider", () => ({ billingStripe: f.stripe }))
import { POST } from "./route"

const req = (body: unknown) =>
  new Request("https://libraries.global/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.clearAllMocks()
  f.user.mockResolvedValue({
    id: "owner",
    email: "owner@example.org",
    name: "Owner",
    plan: "free",
    planSource: "none",
  })
  f.checkout.mockResolvedValue({
    url: "https://checkout.stripe.com/test",
    attemptId: "attempt",
  })
})
describe("checkout purchase contract", () => {
  it.each(["amount", "priceId", "customerId", "referenceId", "successUrl"])(
    "rejects a client-supplied %s",
    async (key) => {
      const res = await POST(
        req({
          plan: "pro",
          interval: "month",
          locale: "en",
          termsVersion: "1.1",
          [key]: "attacker",
        })
      )
      expect(res.status).toBe(400)
      expect(f.checkout).not.toHaveBeenCalled()
    }
  )
  it("uses the session identity and the guarded mutation path", async () => {
    expect(
      (
        await POST(
          req({
            plan: "pro",
            interval: "month",
            locale: "en",
            termsVersion: "1.1",
          })
        )
      ).status
    ).toBe(200)
    expect(f.user).toHaveBeenCalledWith(expect.any(Request), true)
    expect(f.checkout.mock.calls[0]?.[2]).toMatchObject({ id: "owner" })
  })
  it("does not sell Pro to an account with earned access", async () => {
    f.user.mockResolvedValue({ id: "owner", plan: "pro", planSource: "earned" })
    expect(
      (
        await POST(
          req({
            plan: "pro",
            interval: "month",
            locale: "en",
            termsVersion: "1.1",
          })
        )
      ).status
    ).toBe(409)
    expect(f.checkout).not.toHaveBeenCalled()
  })
})
