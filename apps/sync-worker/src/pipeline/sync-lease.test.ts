import { beforeEach, expect, it, vi } from "vitest"

import db from "../db"
import { withSyncLease } from "./sync-lease"

vi.mock("../db", () => ({
  default: {
    client: {
      acquireConnection: vi.fn(),
      releaseConnection: vi.fn(),
      destroyConnection: vi.fn(),
    },
  },
}))
beforeEach(() => vi.resetAllMocks())
it("does not run a second worker while the lease is held", async () => {
  const connection = {
    query: vi.fn().mockResolvedValue({ rows: [{ locked: false }] }),
  }
  vi.mocked(db.client.acquireConnection).mockResolvedValue(connection)
  const work = vi.fn()
  expect(await withSyncLease(work)).toBe(false)
  expect(work).not.toHaveBeenCalled()
  expect(db.client.releaseConnection).toHaveBeenCalledWith(connection)
})
it("unlocks on the same connection even when a run fails", async () => {
  const connection = {
    query: vi.fn().mockResolvedValue({ rows: [{ locked: true }] }),
  }
  vi.mocked(db.client.acquireConnection).mockResolvedValue(connection)
  await expect(
    withSyncLease(async () => {
      throw new Error("failed")
    })
  ).rejects.toThrow("failed")
  expect(connection.query).toHaveBeenLastCalledWith(
    "SELECT pg_advisory_unlock($1)",
    [7420111]
  )
  expect(db.client.releaseConnection).toHaveBeenCalledWith(connection)
})
it("destroys a connection whose lock cannot be released", async () => {
  const connection = {
    query: vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockRejectedValueOnce(new Error("connection lost")),
  }
  vi.mocked(db.client.acquireConnection).mockResolvedValue(connection)
  await withSyncLease(async () => {})
  expect(db.client.destroyConnection).toHaveBeenCalledWith(connection)
  expect(db.client.releaseConnection).not.toHaveBeenCalled()
})
