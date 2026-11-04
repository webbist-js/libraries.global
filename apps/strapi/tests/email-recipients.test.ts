import { describe, expect, it, vi } from "vitest"

import { verifiedEmailMap } from "../src/utils/email-recipients"

describe("owned service-email recipients", () => {
  it("reads only verified requested owners locally and excludes sandbox recipients", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 1, email: "owner@example.org" },
      { id: 2, email: "billing@example.invalid" },
      { id: 3, email: "foreign@example.org" },
    ])
    const query = vi.fn(() => ({ findMany }))
    const result = await verifiedEmailMap({ db: { query } }, [
      "1",
      "2",
      "deleted-legacy",
    ])
    expect([...result]).toEqual([["1", "owner@example.org"]])
    expect(query).toHaveBeenCalledWith("plugin::better-auth.user")
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { $in: [1, 2] }, emailVerified: true },
      select: ["id", "email"],
    })
  })
})
