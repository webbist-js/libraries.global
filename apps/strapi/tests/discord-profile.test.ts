import { expect, it } from "vitest"

import { verifiedDiscordProfile } from "../src/auth/discord-profile"

it.each([
  { verified: false, email: "person@example.invalid" },
  { verified: true },
  { verified: true, email: " " },
])("rejects Discord identity without verified email: %j", (profile) => {
  expect(() => verifiedDiscordProfile(profile)).toThrow(
    "Verify your Discord email"
  )
})
it("preserves the provider's verified identity without inventing fields", () => {
  expect(
    verifiedDiscordProfile({ verified: true, email: "person@example.invalid" })
  ).toEqual({})
})
