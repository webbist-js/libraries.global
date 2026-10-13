import { afterEach, describe, expect, it, vi } from "vitest"

import { verifiedEmailMap } from "../src/utils/email-recipients"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe("owned service-email recipients", () => {
  it("uses only requested verified owners and keeps fictional sandbox recipients out of SMTP", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            { id: "owner", email: "owner@example.org" },
            { id: "fixture", email: "billing@example.invalid" },
            { id: "foreign", email: "foreign@example.org" },
          ],
        })
      )
    )
    const result = await verifiedEmailMap({ log: { warn: vi.fn() } }, [
      "owner",
      "fixture",
    ])
    expect([...result]).toEqual([["owner", "owner@example.org"]])
  })
})
