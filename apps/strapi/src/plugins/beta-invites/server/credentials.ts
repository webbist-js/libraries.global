import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"

export const INVITE_LIFETIME = 7 * 86400000
export const ACCESS_LIFETIME = 30 * 86400000
export const validCode = (code: unknown): code is string =>
  typeof code === "string" && /^[A-Za-z0-9_-]{43}$/.test(code)
export const hashCode = (code: string) =>
  createHash("sha256").update(code).digest("hex")

function key() {
  const secret = process.env.EMAIL_LINK_SECRET
  if (!secret || secret.length < 32)
    throw new Error("Invitation email encryption is unavailable")

  return createHash("sha256").update(`beta-invitation:${secret}`).digest()
}

/** The queue stores only an invitation ID; its recoverable credential is encrypted until sent. */
export function sealCode(code: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const encrypted = Buffer.concat([cipher.update(code, "utf8"), cipher.final()])

  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url"
  )
}

export function openCode(value: string): string {
  const sealed = Buffer.from(value, "base64url")
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    sealed.subarray(0, 12)
  )
  decipher.setAuthTag(sealed.subarray(12, 28))

  return Buffer.concat([
    decipher.update(sealed.subarray(28)),
    decipher.final(),
  ]).toString("utf8")
}

export function newCredential() {
  const code = randomBytes(32).toString("base64url")

  return { tokenHash: hashCode(code), tokenCiphertext: sealCode(code) }
}
