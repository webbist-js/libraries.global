import type { Pool, PoolClient } from "pg"
import type Stripe from "stripe"
import { afterEach, expect, it, vi } from "vitest"

import { refreshSubscription } from "../events"

const { client } = vi.hoisted(() => ({ client: { query: vi.fn() } }))
vi.mock("../database", () => ({
  withBillingLock: async (
    _pool: unknown,
    _key: string,
    run: (connection: PoolClient) => Promise<unknown>
  ) => run(client as unknown as PoolClient),
}))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

it("ignores a delayed old subscription after its beta customer binding was erased", async () => {
  vi.stubEnv("BILLING_ENV", "sandbox")
  client.query.mockResolvedValue({ rows: [] })
  const stripe = {
    subscriptions: {
      retrieve: vi.fn(async () => ({
        id: "sub_old_beta",
        customer: "cus_old_beta",
        livemode: false,
        metadata: { lg_user_id: "1", lg_attempt_id: "old_attempt" },
      })),
    },
  } as unknown as Stripe
  await refreshSubscription({} as Pool, stripe, "sub_old_beta")
  expect(client.query).toHaveBeenCalledTimes(1)
  expect(client.query).toHaveBeenCalledWith(
    expect.stringContaining("from billing_accounts where customer_id=$1"),
    ["cus_old_beta"]
  )
})
