import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { signState, verifyState } from "../oauth-state"

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-characters-long"
})

const payload = () => ({
  nonce: "n1",
  userId: "u1",
  libraryDocumentId: "lib1",
  exp: Date.now() + 60_000,
})

describe("oauth state", () => {
  it("round-trips a signed payload", () => {
    const p = payload()
    expect(verifyState(signState(p))).toEqual(p)
  })

  it("rejects tampering and expiry", () => {
    const t = signState(payload())
    const [body, sig] = t.split(".")
    const forged = Buffer.from(
      JSON.stringify({ ...payload(), userId: "u2" })
    ).toString("base64url")
    expect(verifyState(`${forged}.${sig}`)).toBeNull()
    const differentPrefix = sig!.startsWith("x") ? "y" : "x"
    expect(verifyState(`${body}.${differentPrefix}${sig!.slice(1)}`)).toBeNull()
    expect(
      verifyState(signState({ ...payload(), exp: Date.now() - 1 }))
    ).toBeNull()
  })
})
