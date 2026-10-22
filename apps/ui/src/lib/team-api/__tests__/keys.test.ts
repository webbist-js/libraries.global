import type { Pool } from "pg"
import { describe, expect, it, vi } from "vitest"

vi.mock("../config", () => ({
  apiAccessActive: (m: { revoked?: boolean } | null) =>
    Boolean(m && !m.revoked),
}))
import { apiMembership, createApiKey, keyDigest } from "../store"

const snapshot = {
  status: "active",
  limits: { keys: 5, requests: 100000, bytes: 10 * 1024 ** 3 },
  revoked: false,
}
function database(revoked = false) {
  const query = vi.fn(async (sql: string) => ({
    rows: sql.includes("select snapshot")
      ? [{ snapshot: { ...snapshot, revoked } }]
      : [{ count: "1000" }],
  }))
  const release = vi.fn()

  return {
    pool: {
      query,
      connect: async () => ({ query, release }),
    } as unknown as Pool,
    query,
    release,
  }
}
describe("unlimited Team API credentials", () => {
  it("upgrades legacy key limits while preserving the Team’s purchased usage pool", async () => {
    const { pool } = database()
    expect((await apiMembership(pool, "team"))?.limits).toEqual({
      ...snapshot.limits,
      keys: null,
    })
    expect(snapshot.limits.keys).toBe(5)
  })
  it("creates another credential without resetting usage or imposing a key count cap", async () => {
    const { pool, query, release } = database()
    const result = await createApiKey(pool, "team", "organiser", {
      name: "Another application",
      scopes: ["search:read"],
      expiresAt: null,
    })
    const insert = query.mock.calls.find(([sql]) =>
      sql.includes("insert into team_api_keys")
    ) as unknown as [string, unknown[]]
    expect(insert[1]).toContain(keyDigest(result.secret))
    expect(insert[1]).not.toContain(result.secret)
    expect(
      query.mock.calls.some(
        ([sql]) =>
          sql.includes("count(*)") ||
          /(?:insert|update|delete).*team_api_usage/.test(sql)
      )
    ).toBe(false)
    expect(release).toHaveBeenCalledOnce()
  })
  it("still refuses credentials without settled, valid API access", async () => {
    const { pool, query } = database(true)
    await expect(
      createApiKey(pool, "team", "organiser", {
        name: "App",
        scopes: ["search:read"],
        expiresAt: null,
      })
    ).rejects.toThrow("api_addon_required")
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes("insert into team_api_keys")
      )
    ).toBe(false)
  })
})
