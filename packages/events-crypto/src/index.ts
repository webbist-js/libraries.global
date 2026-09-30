import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGO = "aes-256-gcm" as const
const IV_BYTES = 12
const TAG_BYTES = 16

/**
 * Blob format version. `1` blobs carry the version and may be bound to a
 * credential documentId through GCM additional authenticated data (AAD), so
 * a blob copied from one credential row to another fails to decrypt.
 * Blobs without `v` are legacy (pre-AAD) rows and are still read; every
 * write produces the current version.
 */
export const BLOB_VERSION = 1

interface CipherBlob {
  v?: number
  iv: string
  tag: string
  ct: string
}

export interface CryptoOptions {
  /** Additional authenticated data, normally the credential's documentId. */
  aad?: string
}

function parseKey(hexKey: string): Buffer {
  const key = Buffer.from(hexKey, "hex")
  if (key.length !== 32) {
    throw new Error("hexKey must be 64 hex characters (32 bytes)")
  }

  return key
}

export function encrypt(
  plaintext: string,
  hexKey: string,
  opts: CryptoOptions = {}
): string {
  const key = parseKey(hexKey)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_BYTES })
  if (opts.aad) cipher.setAAD(Buffer.from(opts.aad, "utf8"))
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return JSON.stringify({
    v: BLOB_VERSION,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ct.toString("base64"),
  } satisfies CipherBlob)
}

export function decrypt(
  blobJson: string,
  hexKey: string,
  prevHexKey?: string,
  opts: CryptoOptions = {}
): string {
  try {
    return _decrypt(blobJson, hexKey, opts)
  } catch (err) {
    // Re-throw programmer mistakes immediately — don't mask them with key fallback
    if (err instanceof TypeError) throw err
    if (err instanceof Error && err.message.startsWith("hexKey must be"))
      throw err
    if (prevHexKey != null) {
      try {
        return _decrypt(blobJson, prevHexKey, opts)
      } catch (err2) {
        if (err2 instanceof TypeError) throw err2
        if (err2 instanceof Error && err2.message.startsWith("hexKey must be"))
          throw err2
      }
    }
    throw new Error("Decryption failed — wrong key or corrupted blob")
  }
}

function _decrypt(
  blobJson: string,
  hexKey: string,
  opts: CryptoOptions
): string {
  const blob = JSON.parse(blobJson) as CipherBlob
  const { iv, tag, ct } = blob
  if (
    typeof iv !== "string" ||
    typeof tag !== "string" ||
    typeof ct !== "string"
  ) {
    throw new TypeError(
      "malformed blob: expected { iv, tag, ct } string fields"
    )
  }
  if (blob.v !== undefined && blob.v !== BLOB_VERSION) {
    throw new TypeError(`malformed blob: unsupported version ${String(blob.v)}`)
  }
  const key = parseKey(hexKey)
  const ivBytes = Buffer.from(iv, "base64")
  const tagBytes = Buffer.from(tag, "base64")
  if (ivBytes.length !== IV_BYTES) {
    throw new TypeError(`malformed blob: iv must be ${IV_BYTES} bytes`)
  }
  if (tagBytes.length !== TAG_BYTES) {
    throw new TypeError(`malformed blob: auth tag must be ${TAG_BYTES} bytes`)
  }
  const decipher = createDecipheriv(ALGO, key, ivBytes, {
    authTagLength: TAG_BYTES,
  })
  if (opts.aad) decipher.setAAD(Buffer.from(opts.aad, "utf8"))
  decipher.setAuthTag(tagBytes)

  return Buffer.concat([
    decipher.update(Buffer.from(ct, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
