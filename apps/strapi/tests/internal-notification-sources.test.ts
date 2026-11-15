import { expect, it, vi } from "vitest"

import { collectContentEvents } from "../src/utils/internal-notifications/events"

it("collects live activity without querying retired waitlist or invitation tables", async () => {
  const query = Object.assign(Promise.resolve([]), {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    whereNot: vi.fn().mockReturnThis(),
    whereIn: vi.fn().mockReturnThis(),
    whereNull: vi.fn().mockReturnThis(),
    whereNotExists: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  })
  const connection = vi.fn(() => query)
  const warn = vi.fn()
  const enqueue = vi.fn()
  const failed = await collectContentEvents(
    { db: { connection }, log: { warn } } as never,
    new Date().toISOString(),
    enqueue
  )
  expect(failed).toBe(0)
  expect(warn).not.toHaveBeenCalled()
  expect(connection.mock.calls.flat()).not.toEqual(
    expect.arrayContaining(["subscribers as source"])
  )
  expect(connection.mock.calls.flat()).not.toEqual(
    expect.arrayContaining(["beta_invitations as source"])
  )
  expect(connection.mock.calls.flat()).toEqual(
    expect.arrayContaining([
      "cm_submissions as source",
      "notifications as source",
    ])
  )
})
