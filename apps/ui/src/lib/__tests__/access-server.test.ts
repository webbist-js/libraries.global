import { describe, expect, it } from "vitest"

import {
  hasCapability,
  requireCapability,
  requireEntitlement,
} from "../access-server"

describe("access-server", () => {
  it("hasCapability fails closed on missing or malformed fields", () => {
    expect(hasCapability(null, "docs.directEdit")).toBe(false)
    expect(hasCapability({}, "docs.directEdit")).toBe(false)
    expect(
      hasCapability({ capabilities: "docs.directEdit" }, "docs.directEdit")
    ).toBe(false)
    expect(
      hasCapability({ capabilities: ["docs.directEdit"] }, "docs.directEdit")
    ).toBe(true)
  })

  it("requireCapability returns 401, 403 or null", async () => {
    expect(requireCapability(null, "docs.directEdit")?.status).toBe(401)
    expect(
      requireCapability({ capabilities: [] }, "docs.directEdit")?.status
    ).toBe(403)
    expect(
      requireCapability(
        { capabilities: ["docs.directEdit"] },
        "docs.directEdit"
      )
    ).toBeNull()
  })

  it("requireEntitlement returns 401, 402 with an upgrade payload, or null", async () => {
    expect(requireEntitlement(null, "atlas.export")?.status).toBe(401)
    const r = requireEntitlement({ features: [] }, "atlas.export")
    expect(r?.status).toBe(402)
    expect(await r?.json()).toEqual({
      error: "Upgrade required",
      feature: "atlas.export",
      upgradeUrl: "/pro",
    })
    expect(
      requireEntitlement({ features: ["atlas.export"] }, "atlas.export")
    ).toBeNull()
  })
})
