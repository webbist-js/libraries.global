import { describe, it, expect } from "vitest"

import { encrypt, decrypt } from "../src/index"

const KEY = "a".repeat(64) // 32 bytes as hex
const PREV_KEY = "b".repeat(64)

describe("encrypt / decrypt", () => {
  it("round-trips a JSON payload", () => {
    const plain = JSON.stringify({ accessToken: "tok_123", orgId: "456" })
    expect(decrypt(encrypt(plain, KEY), KEY)).toBe(plain)
  })

  it("produces different ciphertext each call (random IV)", () => {
    expect(encrypt("hello", KEY)).not.toBe(encrypt("hello", KEY))
  })

  it("decrypts with prevKey when current key fails", () => {
    const blob = encrypt("secret", PREV_KEY)
    expect(decrypt(blob, KEY, PREV_KEY)).toBe("secret")
  })

  it("throws on wrong key with no fallback", () => {
    const blob = encrypt("secret", KEY)
    expect(() => decrypt(blob, PREV_KEY)).toThrow()
  })
})
