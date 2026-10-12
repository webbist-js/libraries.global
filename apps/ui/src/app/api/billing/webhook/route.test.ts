import { createHmac, randomUUID } from "node:crypto"

import { beforeEach, describe, expect, it, vi } from "vitest"

const query = vi.hoisted(() => vi.fn(async () => ({ rows: [] })))
vi.mock("@/lib/auth", () => ({ authDbPool: { query } }))
vi.mock("@/lib/billing/http", () => ({
  billingJson: (body: unknown, status = 200) => Response.json(body, { status }),
  billingFailure: (e: { status?: number } | undefined) =>
    Response.json({}, { status: e?.status ?? 503 }),
}))
import { POST } from "./route"

const secret = `whsec_${randomUUID()}`
const sign = (payload: string) => {
  const timestamp = Math.floor(Date.now() / 1000)

  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`
}
const request = (payload: string, signature: string) =>
  new Request("https://libraries.global/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  })
beforeEach(() => {
  query.mockClear()
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture")
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret)
  vi.stubEnv("BILLING_ENV", "sandbox")
})
describe("signed, durable billing webhook", () => {
  it("rejects forged or altered bodies before touching the database", async () => {
    expect((await POST(request("{}", "invalid"))).status).toBe(400)
    expect(query).not.toHaveBeenCalled()
    const payload = JSON.stringify({
      id: "evt_1",
      type: "invoice.paid",
      livemode: false,
      data: { object: { id: "in_1" } },
    })
    const signature = sign(payload)
    expect((await POST(request(payload + " ", signature))).status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })
  it("persists only the event references before acknowledging, even with checkout off", async () => {
    vi.stubEnv("PRO_ENABLED", "false")
    const payload = JSON.stringify({
      id: "evt_1",
      type: "invoice.paid",
      livemode: false,
      data: { object: { id: "in_1", customer_email: "private@example.org" } },
    })
    const res = await POST(request(payload, sign(payload)))
    expect(res.status).toBe(200)
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("on conflict do nothing"),
      ["evt_1", "invoice.paid", "in_1"]
    )
    expect(JSON.stringify(query.mock.calls)).not.toContain(
      "private@example.org"
    )
  })
  it("rejects live events on the sandbox endpoint", async () => {
    const payload = JSON.stringify({
      id: "evt_live",
      type: "invoice.paid",
      livemode: true,
      data: { object: { id: "in_1" } },
    })
    expect((await POST(request(payload, sign(payload)))).status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })
})
