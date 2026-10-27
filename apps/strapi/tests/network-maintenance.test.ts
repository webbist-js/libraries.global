import { afterEach, expect, it, vi } from "vitest"

import cronTasks from "../config/cron-tasks"
import { networkFixture, NET, L1, L2, STAFF } from "./helpers/network-strapi"
import operations from "../src/api/notification/controllers/notification"
import {
  approveNetworkClaim,
  submitNetworkClaim,
} from "../src/plugins/access/server/services/network-claims"
import {
  MANDATE,
  SUBMISSION,
  type SubmissionRecord,
} from "../src/plugins/access/server/services/network-records"

const operatorSecret = "operator-fixture"
const action = "networkFulfilment"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it("continues approved network access batches through the private operator while CMS cron is disabled", async () => {
  const f = networkFixture()
  const claim = await submitNetworkClaim(
    f.strapi,
    { id: "manager", email: "manager@example.test", name: "Manager" },
    NET,
    {
      intent: "management",
      role: "Service manager",
      note: "I manage these libraries.",
      libraryIds: [L1, L2],
    }
  )
  const submission = await f.strapi
    .documents(SUBMISSION)
    .findOne({ documentId: claim.documentId })
  await approveNetworkClaim(
    f.strapi,
    submission as SubmissionRecord,
    "ba:moderator"
  )
  expect(f.store[STAFF] ?? []).toHaveLength(0)
  vi.stubGlobal("strapi", f.strapi)
  vi.stubEnv("STRAPI_BRIDGE_SECRET", operatorSecret)
  vi.stubEnv("CRON_ENABLED", "false")
  const ctx = {
    request: {
      headers: { "x-service-secret": operatorSecret },
      body: { action },
    },
    set: vi.fn(),
    send: vi.fn(),
    badRequest: vi.fn(),
  }
  await operations.operations(ctx)
  expect(ctx.send).toHaveBeenCalledWith({
    ran: true,
    result: { mandates: 1, applied: 2 },
  })
  expect(ctx.set).toHaveBeenCalledWith("Cache-Control", "private, no-store")
  expect(f.store[STAFF]).toHaveLength(2)
  expect(f.store[MANDATE][0].fulfilment.complete).toBe(true)
})

it.each([undefined, "wrong-secret"])(
  "refuses network maintenance with an invalid operator credential",
  async (secret) => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", operatorSecret)
    const ctx = {
      request: {
        headers: { "x-service-secret": secret },
        body: { action },
      },
      unauthorized: vi.fn(),
    }
    await operations.operations(ctx)
    expect(ctx.unauthorized).toHaveBeenCalledOnce()
  }
)

it("shares the database leader lock between CMS cron and operator scheduling", async () => {
  const f = networkFixture()
  const raw = vi.fn().mockResolvedValue({ rows: [{ locked: false }] })
  Object.assign(f.strapi.log, { debug: vi.fn() })
  Object.assign(f.strapi.db, {
    dialect: { client: "pg" },
    connection: {
      transaction: (work: (trx: { raw: typeof raw }) => Promise<unknown>) =>
        work({ raw }),
    },
  })
  vi.stubGlobal("strapi", f.strapi)
  vi.stubEnv("STRAPI_BRIDGE_SECRET", operatorSecret)
  const ctx = {
    request: {
      headers: { "x-service-secret": operatorSecret },
      body: { action },
    },
    set: vi.fn(),
    send: vi.fn(),
    badRequest: vi.fn(),
  }
  await operations.operations(ctx)
  await cronTasks.networkFulfilment.task({ strapi: f.strapi })
  expect(ctx.send).toHaveBeenCalledWith({ ran: false })
  expect(raw).toHaveBeenCalledTimes(2)
  expect(raw.mock.calls[0][1]).toEqual(raw.mock.calls[1][1])
  expect(f.store[STAFF] ?? []).toHaveLength(0)
})
