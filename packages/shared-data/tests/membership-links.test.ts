import { describe, expect, it } from "vitest"

import { membershipLink } from "../membership-links"

describe("membership link destinations", () => {
  it.each([
    ["/contribute/membership", "/plans"],
    ["/cs/contribute/membership#plan-pro", "/cs/plans#plan-pro"],
    [
      "https://libraries.global/fr/contribute/membership?from=atlas",
      "https://libraries.global/fr/plans?from=atlas",
    ],
    ["/membership", "/profile/membership"],
    [
      "/cs/membership?billing=return#recognition",
      "/cs/profile/membership?billing=return#recognition",
    ],
    ["/profile/settings#membership", "/profile/membership"],
    [
      "/fr/profile/settings#supporter-settings",
      "/fr/profile/membership#recognition",
    ],
    ["/pro", "/plans"],
  ])("rewrites %s", (input, output) =>
    expect(membershipLink(input)).toBe(output)
  )
  it.each([
    "/contribute/membership/checkout?attempt=123",
    "/fr/contribute/membership/checkout?plan=pro",
    "/profile/settings#privacy",
    "/plans#plan-pro",
    "/profile/membership",
    "https://other.example/contribute/membership",
    "//other.example/contribute/membership",
    "/contribute/membership-other",
    "mailto:info@libraries.global",
  ])("preserves %s", (input) => expect(membershipLink(input)).toBe(input))
})
