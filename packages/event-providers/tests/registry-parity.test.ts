import { EVENT_PROVIDER_KEYS } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import { getProvider, providerRegistry } from "../src"

describe("provider registry", () => {
  it("registers every provider the shared registry lists, and no others", () => {
    expect([...providerRegistry.keys()].sort()).toEqual(
      [...EVENT_PROVIDER_KEYS].sort()
    )
    for (const k of EVENT_PROVIDER_KEYS) expect(getProvider(k)?.name).toBe(k)
    expect(getProvider("meetup")).toBeUndefined()
  })
})
