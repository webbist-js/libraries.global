/** Shared helpers for the plugin's admin controllers. */

export function fail(
  ctx: any,
  status: number,
  message: string,
  extra: Record<string, unknown> = {}
): void {
  ctx.status = status
  ctx.body = { error: { status, message, ...extra } }
}

/** The signed-in admin, or null. Never read from the body. */
export const adminOf = (ctx: any): { id: string | number } | null => {
  const admin = ctx.state?.user ?? ctx.state?.admin
  const id = admin?.id

  return typeof id === "number" || typeof id === "string" ? { id } : null
}

// Strapi v5 documentIds are 24 lowercase alphanumerics; allow 20–32 for safety.
const DOCUMENT_ID = /^[a-z0-9]{20,32}$/

export function isDocumentId(v: unknown): v is string {
  return typeof v === "string" && DOCUMENT_ID.test(v)
}

/** Better Auth ids: URL-safe, bounded. */
const BA_USER_ID = /^[A-Za-z0-9_-]{1,128}$/

export function isBaUserId(v: unknown): v is string {
  return typeof v === "string" && BA_USER_ID.test(v)
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isEmail = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 254 && EMAIL.test(v.trim())

export const REASON_MAX = 500

/** A required reason of 1–500 characters, or an error message. */
export function parseReason(
  v: unknown,
  verb: string
): { ok: true; value: string } | { ok: false; message: string } {
  const reason = typeof v === "string" ? v.trim() : ""
  if (!reason) return { ok: false, message: `Say why you're ${verb} it.` }
  if (reason.length > REASON_MAX)
    return {
      ok: false,
      message: `Keep the reason to ${REASON_MAX} characters or fewer.`,
    }

  return { ok: true, value: reason }
}

/** An optional future expiry (ISO), null for none, or an error message. */
export function parseExpiry(
  v: unknown,
  now: Date = new Date()
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (v === undefined || v === null || v === "")
    return { ok: true, value: null }
  const at = typeof v === "string" ? new Date(v) : new Date(Number.NaN)
  if (Number.isNaN(at.getTime()))
    return { ok: false, message: "The expiry must be a date." }
  if (at.getTime() <= now.getTime())
    return { ok: false, message: "The expiry must be in the future." }

  return { ok: true, value: at.toISOString() }
}

/** The plugin's own error: an HTTP status and a stable code. */
export class AccessError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string
  ) {
    super(message ?? code)
  }
}
