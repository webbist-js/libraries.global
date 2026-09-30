import { invalidateSessionProfile } from "@/lib/session-profile"

export type DeleteProfileResult =
  | { ok: true }
  | { ok: false; reason: "unconfigured" | "strapi" }

/**
 * Remove (anonymise) the user's Strapi profile through the auth bridge.
 * Called by the account-deletion route and by Better Auth's `beforeDelete`
 * hook, so a deletion through either path takes the profile with it.
 */
export async function deleteStrapiProfile({
  baUserId,
  email,
}: {
  baUserId: string
  email: string
}): Promise<DeleteProfileResult> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return { ok: false, reason: "unconfigured" }
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

  try {
    const res = await fetch(`${strapiUrl}/api/auth-bridge/delete-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": secret,
      },
      body: JSON.stringify({ baUserId, email }),
      cache: "no-store",
    })
    if (!res.ok) return { ok: false, reason: "strapi" }
  } catch {
    return { ok: false, reason: "strapi" }
  }
  invalidateSessionProfile(baUserId)

  return { ok: true }
}
