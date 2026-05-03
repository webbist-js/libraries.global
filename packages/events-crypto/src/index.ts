import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGO = "aes-256-gcm" as const

interface CipherBlob {
  iv: string
  tag: string
  ct: string
}

export function encrypt(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, "hex")
  if (key.length !== 32) {
    throw new Error("hexKey must be 64 hex characters (32 bytes)")
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return JSON.stringify({
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ct.toString("base64"),
  } satisfies CipherBlob)
}

export function decrypt(
  blobJson: string,
  hexKey: string,
  prevHexKey?: string
): string {
  try {
    return _decrypt(blobJson, hexKey)
  } catch {
    if (prevHexKey != null) return _decrypt(blobJson, prevHexKey)
    throw new Error("Decryption failed — wrong key or corrupted blob")
  }
}

function _decrypt(blobJson: string, hexKey: string): string {
  const { iv, tag, ct } = JSON.parse(blobJson) as CipherBlob
  if (
    typeof iv !== "string" ||
    typeof tag !== "string" ||
    typeof ct !== "string"
  ) {
    throw new TypeError(
      "malformed blob: expected { iv, tag, ct } string fields"
    )
  }
  const key = Buffer.from(hexKey, "hex")
  if (key.length !== 32) {
    throw new Error("hexKey must be 64 hex characters (32 bytes)")
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(iv, "base64"))
  decipher.setAuthTag(Buffer.from(tag, "base64"))

  return Buffer.concat([
    decipher.update(Buffer.from(ct, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
