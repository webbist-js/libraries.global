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

  it("throws when key is wrong length on encrypt", () => {
    expect(() => encrypt("hello", "aabb")).toThrow(
      "hexKey must be 64 hex characters (32 bytes)"
    )
  })

  it("throws when key is wrong length on decrypt (no fallback)", () => {
    const blob = encrypt("hello", KEY)
    expect(() => decrypt(blob, "aabb")).toThrow(
      "hexKey must be 64 hex characters (32 bytes)"
    )
  })

  it("throws on malformed blob (missing fields)", () => {
    // decrypt() re-throws TypeError without wrapping
    expect(() => decrypt(JSON.stringify({ iv: "x" }), KEY)).toThrow(TypeError)
  })

  it("re-throws blob shape error from decrypt without wrapping", () => {
    // Valid JSON but missing required fields → TypeError is re-thrown
    expect(() => decrypt(JSON.stringify({}), KEY)).toThrow(TypeError)
  })

  it("throws on malformed blob (not valid JSON)", () => {
    expect(() => decrypt("not-json", KEY)).toThrow()
  })
})
