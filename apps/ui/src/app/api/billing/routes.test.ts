import { beforeEach, describe, expect, it, vi } from "vitest"

import type * as BillingProvider from "@/lib/billing/provider"

const f = vi.hoisted(() => ({
  user: vi.fn(),
  query: vi.fn(),
  invoices: vi.fn(),
  portal: vi.fn(),
  invalidate: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ authDbPool: { query: f.query } }))
vi.mock("@/lib/billing/http", () => ({
  billingUser: f.user,
  billingJson: (data: unknown, status = 200) => Response.json(data, { status }),
  billingFailure: (e: { code: string; status: number }) =>
    Response.json({ error: e.code }, { status: e.status ?? 503 }),
}))
vi.mock("@/lib/billing/provider", async (original) => ({
  ...(await original<typeof BillingProvider>()),
  billingStripe: () => ({
    invoices: { list: f.invoices },
    billingPortal: { sessions: { create: f.portal } },
  }),
}))
vi.mock("@/lib/session-profile", () => ({
  invalidateSessionProfile: f.invalidate,
}))
import { POST as portal } from "./portal/route"
import { GET as status } from "./status/route"
import { GET as summary } from "./summary/route"

const request = new Request(
  "https://libraries.global/api/billing/status?attempt=11111111-1111-4111-8111-111111111111&customer=attacker"
)
const membership = {
  mode: "sandbox",
  plan: "pro",
  interval: "month",
  status: "active",
  currency: "gbp",
  unitAmount: 500,
  memberSince: new Date().toISOString(),
  periodEnd: null,
  paidThrough: new Date(Date.now() + 86_400_000).toISOString(),
  pastDueSince: null,
  cancelAtPeriodEnd: false,
  revoked: false,
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("BILLING_ENV", "sandbox")
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture")
  vi.stubEnv("STRIPE_PORTAL_CONFIGURATION", "bpc_pro")
  f.user.mockResolvedValue({ id: "owner", plan: "pro", planSource: "earned" })
  f.portal.mockResolvedValue({ url: "https://billing.stripe.com/p/session" })
  f.invoices.mockResolvedValue({ data: [] })
})
describe("owned billing reads and provider management", () => {
  it("cannot use another owner's opaque checkout attempt", async () => {
    f.query.mockResolvedValueOnce({ rows: [] })
    expect((await status(request)).status).toBe(404)
    expect(f.query.mock.calls[0]?.[1]).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "owner",
    ])
  })
  it("waits for both settlement and backend synchronization", async () => {
    f.query
      .mockResolvedValueOnce({ rows: [{ state: "complete" }] })
      .mockResolvedValueOnce({
        rows: [{ snapshot: membership, revision: "2", synced_revision: "1" }],
      })
    expect(await (await status(request)).json()).toMatchObject({
      state: "sync_pending",
      membership: null,
    })
    expect(f.invalidate).not.toHaveBeenCalled()
    f.query
      .mockResolvedValueOnce({ rows: [{ state: "complete" }] })
      .mockResolvedValueOnce({
        rows: [{ snapshot: membership, revision: "2", synced_revision: "2" }],
      })
    expect(await (await status(request)).json()).toMatchObject({
      state: "ready",
    })
    expect(f.invalidate).toHaveBeenCalledWith("owner")
  })
  it("refuses portal access when an account belongs to a different environment", async () => {
    f.query.mockResolvedValueOnce({
      rows: [
        {
          customer_id: "cus_other",
          mode: "live",
          deleting: false,
          erased_at: null,
        },
      ],
    })
    expect((await portal(request)).status).toBe(503)
    expect(f.portal).not.toHaveBeenCalled()
  })
  it("uses the stored owner for portal and invoice retrieval", async () => {
    const account = {
      customer_id: "cus_owner",
      mode: "sandbox",
      deleting: false,
      erased_at: null,
    }
    f.query
      .mockResolvedValueOnce({ rows: [account] })
      .mockResolvedValueOnce({ rows: [] })
    expect((await portal(request)).status).toBe(200)
    expect(f.user).toHaveBeenCalledWith(request, true)
    expect(f.portal).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_owner" })
    )
    f.query
      .mockResolvedValueOnce({ rows: [{ snapshot: membership }] })
      .mockResolvedValueOnce({ rows: [account] })
    expect(await (await summary(request)).json()).toMatchObject({
      effectivePlan: "pro",
      accessSource: "earned",
      membership: { plan: "pro" },
    })
    expect(f.invoices).toHaveBeenCalledWith({
      customer: "cus_owner",
      limit: 12,
    })
  })
  it("hides cross-environment projections and does not retrieve their invoices", async () => {
    f.query
      .mockResolvedValueOnce({
        rows: [{ snapshot: { ...membership, mode: "live" } }],
      })
      .mockResolvedValueOnce({
        rows: [{ customer_id: "cus_other", mode: "live" }],
      })
    expect(await (await summary(request)).json()).toMatchObject({
      membership: null,
      canManage: false,
      invoices: [],
    })
    expect(f.invoices).not.toHaveBeenCalled()
  })
  it("reports a paid invoice awaiting its owned checkout projection as confirming, without granting access", async () => {
    f.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [
        {
          customer_id: "cus_owner",
          mode: "sandbox",
          deleting: false,
          erased_at: null,
          confirmation_pending: true,
        },
      ],
    })
    f.user.mockResolvedValue({ id: "owner", plan: "free", planSource: "none" })
    f.invoices.mockResolvedValue({
      data: [{ id: "in_paid", status: "paid", lines: { data: [] } }],
    })
    expect(await (await summary(request)).json()).toMatchObject({
      membership: null,
      confirmationPending: true,
      effectivePlan: "free",
    })
    expect(f.query.mock.calls[1]?.[1]).toEqual(["owner"])
  })
})
