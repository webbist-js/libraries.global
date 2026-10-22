import { describe, expect, it } from "vitest"

import { betaWelcomeVisit, BETA_VISIT_IDLE_MS } from "../welcome"

describe("beta welcome visits", () => {
  it("welcomes a new visitor and stays dismissed through navigation and reloads", () => {
    expect(betaWelcomeVisit(null, "guest", 100)).toMatchObject({
      dismissed: false,
    })
    const saved = JSON.stringify({
      scope: "reader",
      dismissed: true,
      lastSeen: 100,
    })
    expect(betaWelcomeVisit(saved, "reader", 200)).toEqual({
      scope: "reader",
      dismissed: true,
      lastSeen: 200,
    })
  })
  it("welcomes after sign-in, account change, or a new visit after inactivity", () => {
    const saved = JSON.stringify({
      scope: "guest",
      dismissed: true,
      lastSeen: 100,
    })
    expect(betaWelcomeVisit(saved, "reader", 200).dismissed).toBe(false)
    expect(
      betaWelcomeVisit(saved, "guest", 100 + BETA_VISIT_IDLE_MS).dismissed
    ).toBe(false)
    expect(betaWelcomeVisit(null, "guest", 200).dismissed).toBe(false)
  })
  it("recovers from malformed, future or obsolete session storage", () => {
    for (const saved of [
      "{",
      "null",
      JSON.stringify({ scope: "guest", dismissed: true, lastSeen: 300 }),
      JSON.stringify({ scope: "guest", dismissed: "yes", lastSeen: 100 }),
    ])
      expect(betaWelcomeVisit(saved, "guest", 200).dismissed).toBe(false)
  })
})
