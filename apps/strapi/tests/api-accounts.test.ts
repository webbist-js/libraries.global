import { afterEach, describe, expect, it, vi } from "vitest"

import { loadApiAccounts } from "../src/utils/api-accounts"

const strapi = { log: { debug: vi.fn() } }
const FUTURE = "2099-01-01T00:00:00.000Z"
const PAST = "2020-01-01T00:00:00.000Z"
const db = (rows: Record<string, unknown>[]) => ({
  query: vi.fn(async () => ({ rows })),
})
const member = [{ teamDocumentId: "team1", teamRole: "member" as const }]

afterEach(() => vi.unstubAllEnvs())

describe("loadApiAccounts", () => {
  it("reads nothing without memberships and fails closed when storage is unavailable", async () => {
    const none = db([])
    expect(await loadApiAccounts(strapi, [], none)).toEqual([])
    expect(none.query).not.toHaveBeenCalled()
    const broken = { query: vi.fn().mockRejectedValue(new Error("down")) }
    expect(await loadApiAccounts(strapi, member, broken)).toEqual([])
  })
  it("binds the billing mode, prefers covering snapshots and bounds the read", async () => {
    vi.stubEnv("BILLING_ENV", "sandbox")
    const source = db([
      // Latest first: a lapsed renewal attempt, then the settled period.
      {
        team_id: "team1",
        paid_through: PAST,
        revoked: "false",
        mode: "sandbox",
      },
      {
        team_id: "team1",
        paid_through: FUTURE,
        revoked: "false",
        mode: "sandbox",
      },
      {
        team_id: "team1",
        paid_through: FUTURE,
        revoked: "false",
        mode: "live",
      },
    ])
    expect(await loadApiAccounts(strapi, member, source)).toEqual([
      { teamId: "team1", role: "member", paidThrough: FUTURE, revoked: false },
    ])
    const [, params] = source.query.mock.calls[0] as unknown as [
      string,
      unknown[],
    ]
    expect(params).toEqual([["team1"], 50])
  })
  it("reports revoked coverage as revoked", async () => {
    const source = db([
      { team_id: "team1", paid_through: FUTURE, revoked: "true" },
    ])
    expect(await loadApiAccounts(strapi, member, source)).toEqual([
      { teamId: "team1", role: "member", paidThrough: FUTURE, revoked: true },
    ])
  })
})
