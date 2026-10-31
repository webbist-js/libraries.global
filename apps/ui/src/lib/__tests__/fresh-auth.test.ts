import { expect, it } from "vitest"

import { sessionIsFresh, reauthenticationResponse } from "../fresh-auth"

it("requires a recent sign-in and rejects missing, malformed, stale or future proofs", () => {
  const now = Date.now()
  expect(sessionIsFresh({ createdAt: new Date(now) }, now)).toBe(true)
  expect(sessionIsFresh({ createdAt: new Date(now - 300_001) }, now)).toBe(
    false
  )
  expect(sessionIsFresh({ createdAt: new Date(now + 60_000) }, now)).toBe(false)
  expect(sessionIsFresh({ createdAt: "invalid" }, now)).toBe(false)
  expect(sessionIsFresh({}, now)).toBe(false)
})
it("provides a private same-site route to sign in before retrying", async () => {
  const response = reauthenticationResponse("/profile/settings")
  expect(response.status).toBe(403)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(await response.json()).toEqual({
    error: "reauthentication_required",
    reauthUrl: "/auth/signin?callbackUrl=%2Fprofile%2Fsettings",
  })
})
