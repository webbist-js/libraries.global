import { canDirectEdit } from "@repo/access"
import { describe, expect, it } from "vitest"

import {
  hasCapability,
  requireCapability,
  requireEntitlement,
  sessionCapabilities,
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
      upgradeUrl: "/contribute/membership",
    })
    expect(
      requireEntitlement({ features: ["atlas.export"] }, "atlas.export")
    ).toBeNull()
  })

  it("sessionCapabilities rebuilds Capabilities from the session fields", () => {
    const c = sessionCapabilities({
      capabilities: ["moderate.queue", "docs.directEdit"],
      claimedLibraryIds: ["libA"],
      moderationScopes: [{ queue: "knowledge", locale: "fr" }],
      editorLocales: { docs: ["fr"], journal: [] },
    })
    expect(c.set.has("moderate.queue")).toBe(true)
    expect([...c.claimedLibraryIds]).toEqual(["libA"])
    expect(c.moderation).toEqual([{ queue: "knowledge", locale: "fr" }])
    expect(canDirectEdit(c, "docs", "fr")).toBe(true)
    expect(canDirectEdit(c, "docs", "en")).toBe(false)
    expect(canDirectEdit(c, "journal", "fr")).toBe(false)
  })

  it("sessionCapabilities fails closed on missing or malformed fields", () => {
    for (const user of [
      null,
      undefined,
      {},
      "x",
      { moderationScopes: [null, "x", { queue: 1 }], editorLocales: null },
    ]) {
      const c = sessionCapabilities(user)
      expect(c.set.size).toBe(0)
      expect(c.moderation).toEqual([])
      expect(canDirectEdit(c, "docs", "en")).toBe(false)
    }
  })
})
