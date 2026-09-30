import { describe, it, expect } from "vitest"

import { BLOB_VERSION, encrypt, decrypt } from "../src/index"

const KEY = "a".repeat(64) // 32 bytes as hex
const PREV_KEY = "b".repeat(64)
const DOC_A = "cred000000000000000000a1"
const DOC_B = "cred000000000000000000b2"

describe("encrypt / decrypt", () => {
  it("round-trips a JSON payload", () => {
    const plain = JSON.stringify({ accessToken: "tok_123", orgId: "456" })
    expect(decrypt(encrypt(plain, KEY), KEY)).toBe(plain)
  })

  it("round-trips with AAD bound to a credential documentId", () => {
    const plain = JSON.stringify({ accessToken: "tok_123" })
    const blob = encrypt(plain, KEY, { aad: DOC_A })
    expect(decrypt(blob, KEY, undefined, { aad: DOC_A })).toBe(plain)
  })

  it("rejects a blob decrypted under another documentId's AAD", () => {
    const blob = encrypt("secret", KEY, { aad: DOC_A })
    expect(() => decrypt(blob, KEY, undefined, { aad: DOC_B })).toThrow(
      /Decryption failed/
    )
    // ...and without any AAD at all
    expect(() => decrypt(blob, KEY)).toThrow(/Decryption failed/)
  })

  it("AAD also applies to the previous-key fallback", () => {
    const blob = encrypt("secret", PREV_KEY, { aad: DOC_A })
    expect(decrypt(blob, KEY, PREV_KEY, { aad: DOC_A })).toBe("secret")
    expect(() => decrypt(blob, KEY, PREV_KEY, { aad: DOC_B })).toThrow(
      /Decryption failed/
    )
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

describe("blob format", () => {
  it("carries a leading version byte", () => {
    const blob = JSON.parse(encrypt("hello", KEY)) as Record<string, string>
    expect(blob.v).toBe(BLOB_VERSION)
    expect(BLOB_VERSION).toBe(1)
    for (const k of ["iv", "tag", "ct"]) expect(typeof blob[k]).toBe("string")
  })

  it("rejects an unknown version", () => {
    const blob = JSON.parse(encrypt("hello", KEY)) as Record<string, unknown>
    blob.v = 99
    expect(() => decrypt(JSON.stringify(blob), KEY)).toThrow(TypeError)
  })

  it("still reads a legacy blob without a version (pre-AAD rows)", () => {
    const blob = JSON.parse(encrypt("hello", KEY)) as Record<string, unknown>
    delete blob.v
    expect(decrypt(JSON.stringify(blob), KEY)).toBe("hello")
  })

  it("rejects a 15-byte auth tag", () => {
    const blob = JSON.parse(encrypt("hello", KEY)) as Record<string, string>
    const tag = Buffer.from(blob.tag!, "base64")
    expect(tag.length).toBe(16)
    blob.tag = tag.subarray(0, 15).toString("base64")
    expect(() => decrypt(JSON.stringify(blob), KEY)).toThrow(TypeError)
    expect(() => decrypt(JSON.stringify(blob), KEY)).toThrow(/auth tag/i)
  })

  it("rejects a 17-byte auth tag and a bad IV length", () => {
    const blob = JSON.parse(encrypt("hello", KEY)) as Record<string, string>
    const longTag = { ...blob, tag: Buffer.alloc(17, 1).toString("base64") }
    expect(() => decrypt(JSON.stringify(longTag), KEY)).toThrow(TypeError)
    const shortIv = { ...blob, iv: Buffer.alloc(8, 1).toString("base64") }
    expect(() => decrypt(JSON.stringify(shortIv), KEY)).toThrow(TypeError)
  })

  it("a tampered ciphertext fails authentication", () => {
    const blob = JSON.parse(encrypt("hello world", KEY)) as Record<
      string,
      string
    >
    const ct = Buffer.from(blob.ct!, "base64")
    ct[0] = ct[0]! ^ 0xff
    blob.ct = ct.toString("base64")
    expect(() => decrypt(JSON.stringify(blob), KEY)).toThrow(
      /Decryption failed/
    )
  })
})
