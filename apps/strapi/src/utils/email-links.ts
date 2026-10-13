import { createHmac, timingSafeEqual } from "node:crypto"

type EmailLink = {
  id: string
  purpose:
    | "digest_unsubscribe"
    | "activity_unsubscribe"
    | "newsletter_confirm"
    | "newsletter_unsubscribe"
  version?: string
  preference?: string
  exp?: number
}

function secret(): string {
  const value = process.env.EMAIL_LINK_SECRET
  if (!value || value.length < 32)
    throw new Error("EMAIL_LINK_SECRET must contain at least 32 characters")

  return value
}

export function emailLinkToken(input: EmailLink): string {
  const payload = Buffer.from(JSON.stringify(input)).toString("base64url")

  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`
}

export function readEmailLink(token: unknown): EmailLink | null {
  if (typeof token !== "string" || token.length > 1500) return null
  try {
    const [payload, signature, extra] = token.split(".")
    if (!payload || !signature || extra) return null
    const expected = createHmac("sha256", secret()).update(payload).digest()
    const given = Buffer.from(signature, "base64url")
    if (given.length !== expected.length || !timingSafeEqual(given, expected))
      return null
    const value = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    ) as EmailLink
    if (
      typeof value.id !== "string" ||
      value.id.length > 200 ||
      ![
        "digest_unsubscribe",
        "activity_unsubscribe",
        "newsletter_confirm",
        "newsletter_unsubscribe",
      ].includes(value.purpose)
    )
      return null
    if (
      value.purpose === "activity_unsubscribe" &&
      ![
        "weeklyReport",
        "editsReviewed",
        "drives",
        "newFollowers",
        "recognition",
        "editorialMessages",
        "marketing",
      ].includes(value.preference ?? "")
    )
      return null
    if (value.exp && (!Number.isFinite(value.exp) || value.exp < Date.now()))
      return null

    return value
  } catch {
    return null
  }
}

export function emailActionUrl(token: string): string {
  return `${(process.env.APP_PUBLIC_URL || "https://libraries.global").replace(/\/$/, "")}/email/preferences?token=${encodeURIComponent(token)}`
}
