import { expect, it } from "vitest"

import { matchesBridgeSecret } from "../service-key"

it("accepts only the current key or an explicitly bounded rotation overlap", () => {
  const now = Date.now()
  const env = {
    STRAPI_BRIDGE_SECRET: "current",
    STRAPI_BRIDGE_PREVIOUS_SECRET: "previous",
    STRAPI_BRIDGE_PREVIOUS_VALID_UNTIL: new Date(now + 3_600_000).toISOString(),
  }
  expect(matchesBridgeSecret("current", env, now)).toBe(true)
  expect(matchesBridgeSecret("previous", env, now)).toBe(true)
  expect(matchesBridgeSecret("invalid", env, now)).toBe(false)
  expect(matchesBridgeSecret("previous", env, now + 3_600_000)).toBe(false)
  expect(
    matchesBridgeSecret(
      "previous",
      { ...env, STRAPI_BRIDGE_PREVIOUS_VALID_UNTIL: "" },
      now
    )
  ).toBe(false)
  expect(
    matchesBridgeSecret(
      "previous",
      {
        ...env,
        STRAPI_BRIDGE_PREVIOUS_VALID_UNTIL: new Date(
          now + 172_800_000
        ).toISOString(),
      },
      now
    )
  ).toBe(false)
  expect(
    matchesBridgeSecret("previous", { ...env, STRAPI_BRIDGE_SECRET: "" }, now)
  ).toBe(false)
})
