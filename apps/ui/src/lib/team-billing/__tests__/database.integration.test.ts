import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"

import { Pool } from "pg"
import type Stripe from "stripe"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const f = vi.hoisted(() => ({ bridge: vi.fn(), invalidate: vi.fn() }))
vi.mock("../bridge", () => ({ teamBillingBridge: f.bridge }))
vi.mock("@/lib/session-profile", () => ({
  invalidateSessionProfile: f.invalidate,
}))

import type { ManagedCheckoutParams } from "../../billing/provider"
import { createSelfServiceTeam, teamCheckout } from "../billing"
import { refreshTeamSubscription, reconcileTeamBilling } from "../sync"

const enabled = process.env.BILLING_DB_TEST === "true"
const schema = `team_billing_test_${randomUUID().replaceAll("-", "")}`
let admin: Pool, pool: Pool
const buyer = {
  id: "team_fixture_owner",
  name: "Owner",
  email: "owner@example.invalid",
}
const accountId = randomUUID()
const teamId = "team00000000000000000001"
type ManagedSessionFixture = Stripe.Checkout.Session & {
  managed_payments: { enabled: boolean }
}
let session: ManagedSessionFixture,
  subscription: Stripe.Subscription,
  invoices: Stripe.Invoice[] = []
const customer = vi.fn(async () => ({ id: "cus_team" }))
const createSession = vi.fn(async (params: ManagedCheckoutParams) => {
  session = {
    ...params,
    id: `cs_${params.metadata!.lg_team_attempt_id}`,
    status: "open",
    livemode: false,
    url: "https://checkout.stripe.com/team",
  } as unknown as ManagedSessionFixture

  return session
})
const retrieveSubscription = vi.fn(async () => subscription)
const stripe = {
  prices: {
    retrieve: async (id: string) => ({
      id,
      active: true,
      livemode: false,
      currency: "gbp",
      unit_amount: id === "price_public" ? 9600 : 12000,
      tax_behavior: "exclusive",
      recurring: {
        interval: "year",
        interval_count: 1,
        usage_type: "licensed",
      },
      product: {
        id: "prod_team",
        active: true,
        tax_code: "txcd_10103001",
        metadata: { lg_feature: "team_seats" },
      },
    }),
  },
  customers: { create: customer },
  subscriptions: {
    list: async () => ({
      data: subscription ? [subscription] : [],
      has_more: false,
    }),
    retrieve: retrieveSubscription,
  },
  invoices: { list: async () => ({ data: invoices, has_more: false }) },
  checkout: {
    sessions: {
      create: createSession,
      retrieve: async () => session,
      expire: async () => {
        session.status = "expired"
      },
    },
  },
} as unknown as Stripe
const choice = { seats: 5, termsVersion: "1.2", locale: "en" as const }
const end = Math.floor(Date.now() / 1000) + 365 * 86400
function settle(seats = 5) {
  session.status = "complete"
  session.subscription = "sub_team"
  subscription = {
    id: "sub_team",
    status: "active",
    livemode: false,
    customer: "cus_team",
    metadata: session.metadata,
    cancel_at_period_end: false,
    latest_invoice: null,
    items: {
      data: [
        {
          id: "si_team",
          quantity: seats,
          price: {
            id: "price_team",
            currency: "gbp",
            unit_amount: 12000,
            tax_behavior: "exclusive",
            recurring: {
              interval: "year",
              interval_count: 1,
              usage_type: "licensed",
            },
          },
        },
      ],
    },
  } as unknown as Stripe.Subscription
  invoices = [
    {
      id: "in_team",
      created: 1,
      status: "paid",
      parent: { subscription_details: { subscription: "sub_team" } },
      lines: {
        data: [
          {
            amount: seats * 12000,
            quantity: seats,
            period: { start: 1, end },
            parent: {
              subscription_item_details: {
                subscription: "sub_team",
                subscription_item: "si_team",
                proration: false,
              },
            },
            pricing: { price_details: { price: "price_team" } },
          },
        ],
      },
    },
  ] as unknown as Stripe.Invoice[]
}
describe.skipIf(!enabled)(
  "Team billing durable ownership and settlement",
  () => {
    beforeAll(async () => {
      admin = new Pool({ connectionString: process.env.DATABASE_URL })
      // eslint-disable-next-line sonarjs/sql-queries -- generated UUID schema
      await admin.query(`create schema ${schema}`)
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        options: `-c search_path=${schema}`,
      })
      for (const name of ["billing", "team-api", "team-billing"])
        await pool.query(
          await readFile(
            new URL(`../../../../scripts/${name}-schema.sql`, import.meta.url),
            "utf8"
          )
        )
      await pool.query(
        'create table "user" (id text primary key, "emailVerified" boolean)'
      )
      await pool.query('insert into "user" values($1,true)', [buyer.id])
      vi.stubEnv("BILLING_ENV", "sandbox")
      vi.stubEnv("TEAM_BILLING_ENABLED", "true")
      vi.stubEnv("STRIPE_MANAGED_PAYMENTS_ENABLED", "true")
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture")
      vi.stubEnv("STRIPE_PRICE_TEAM_SEAT_ANNUAL", "price_team")
      vi.stubEnv("STRIPE_PRICE_TEAM_PUBLIC_SEAT_ANNUAL", "price_public")
      f.bridge.mockImplementation(async (action: string) => {
        if (action === "create") return { teamId }
        if (action === "context")
          return {
            accountId,
            teamId,
            name: "Test Team",
            discounted: false,
            used: 1,
          }

        return { userIds: [buyer.id], capacityBlocked: false }
      })
    })
    afterAll(async () => {
      if (pool) await pool.end()
      if (admin) {
        // eslint-disable-next-line sonarjs/sql-queries -- generated UUID schema
        await admin.query(`drop schema ${schema} cascade`)
        await admin.end()
      }
      vi.unstubAllEnvs()
    })
    it("creates one organisation per durable signup and refuses another buyer's replay", async () => {
      const input = { requestId: accountId, name: "Test Team" }
      expect(await createSelfServiceTeam(pool, buyer, input)).toEqual({
        teamId,
      })
      expect(await createSelfServiceTeam(pool, buyer, input)).toEqual({
        teamId,
      })
      expect(
        f.bridge.mock.calls.filter(([action]) => action === "create")
      ).toHaveLength(1)
      await pool.query('insert into "user" values($1,true)', ["other"])
      await expect(
        createSelfServiceTeam(pool, { ...buyer, id: "other" }, input)
      ).rejects.toThrow("team_signup_conflict")
    })
    it("serializes checkout and reuses one persisted customer and session", async () => {
      let release!: () => void, entered!: () => void
      const gate = new Promise<void>((r) => {
        release = r
      })
      const entry = new Promise<void>((r) => {
        entered = r
      })
      const original = createSession.getMockImplementation()!
      createSession.mockImplementationOnce(async (params) => {
        entered()
        await gate

        return original(params)
      })
      const first = teamCheckout(pool, stripe, teamId, buyer, choice)
      await entry
      await expect(
        teamCheckout(pool, stripe, teamId, buyer, choice)
      ).rejects.toThrow("billing_busy")
      release()
      const result = await first
      expect(await teamCheckout(pool, stripe, teamId, buyer, choice)).toEqual(
        result
      )
      expect(customer).toHaveBeenCalledTimes(1)
      expect(createSession).toHaveBeenCalledTimes(1)
      expect(session.line_items).toEqual([{ price: "price_team", quantity: 5 }])
      expect(session.managed_payments).toEqual({ enabled: true })
      expect(
        (await pool.query("select * from team_billing_memberships")).rowCount
      ).toBe(0)
    })
    it("uses the same idempotency key after a provider timeout", async () => {
      session.status = "expired"
      createSession.mockRejectedValueOnce(new Error("timeout"))
      await expect(
        teamCheckout(pool, stripe, teamId, buyer, choice)
      ).rejects.toThrow("timeout")
      const preparing = (
        await pool.query(
          "select * from team_billing_attempts where state='preparing'"
        )
      ).rows[0]
      expect(preparing).toBeTruthy()
      await teamCheckout(pool, stripe, teamId, buyer, choice)
      const calls = createSession.mock.calls as unknown as [
        unknown,
        { idempotencyKey: string },
      ][]
      expect(calls.at(-1)![1].idempotencyKey).toBe(
        calls.at(-2)![1].idempotencyKey
      )
    })
    it("proves binding and settlement, then reconciles a lost webhook and backend retry", async () => {
      settle()
      const original = session.client_reference_id
      session.client_reference_id = "foreign"
      await expect(
        refreshTeamSubscription(pool, stripe, "sub_team")
      ).rejects.toThrow("binding_invalid")
      session.client_reference_id = original
      f.bridge.mockRejectedValueOnce(new Error("backend unavailable"))
      expect(await reconcileTeamBilling(pool, stripe, () => true)).toBe(1)
      let row = (await pool.query("select * from team_billing_memberships"))
        .rows[0]
      expect(row.snapshot.paidSeats).toBe(5)
      expect(row.synced_revision).toBe("0")
      await pool.query("update team_billing_memberships set next_sync_at=now()")
      expect(await reconcileTeamBilling(pool, stripe, () => true)).toBe(0)
      row = (await pool.query("select * from team_billing_memberships")).rows[0]
      expect(row.synced_revision).toBe(row.revision)
      const version = row.revision
      await refreshTeamSubscription(pool, stripe, "sub_team")
      expect(
        (await pool.query("select revision from team_billing_memberships"))
          .rows[0].revision
      ).toBe(version)
      expect(f.invalidate).toHaveBeenCalledWith(buyer.id)
    })
    it("refetches subscription state inside the account lock before projecting", async () => {
      retrieveSubscription.mockResolvedValueOnce({
        ...subscription,
        status: "unpaid",
      })
      await refreshTeamSubscription(pool, stripe, "sub_team")
      expect(
        (await pool.query("select snapshot from team_billing_memberships"))
          .rows[0].snapshot.status
      ).toBe("active")
    })
    it("refuses duplicate subscriptions, unpaid seats and reversal replays", async () => {
      await expect(
        teamCheckout(pool, stripe, teamId, buyer, choice)
      ).rejects.toThrow("already_exists")
      subscription.items.data[0]!.quantity = 8
      await refreshTeamSubscription(pool, stripe, "sub_team")
      expect(
        (await pool.query("select snapshot from team_billing_memberships"))
          .rows[0].snapshot.paidSeats
      ).toBe(5)
      await refreshTeamSubscription(pool, stripe, "sub_team", {
        revoke: true,
        reversedInvoice: "in_team",
      })
      await refreshTeamSubscription(pool, stripe, "sub_team")
      expect(
        (await pool.query("select snapshot from team_billing_memberships"))
          .rows[0].snapshot
      ).toMatchObject({ revoked: true, accessUntil: null })
    })
  }
)
