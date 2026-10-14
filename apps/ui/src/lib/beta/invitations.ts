import "server-only"

import { type BetaPass, readBetaPass } from "./access"

/** Only the UI server may redeem or check invitations; browser credentials never reach CMS directly. */
async function bridge(action: "redeem" | "validate", body: object) {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) throw new Error("Beta invitations are unavailable")

  return fetch(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/beta-invites/${action}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": secret,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    }
  )
}

export async function redeemBetaInvitation(
  code: string
): Promise<BetaPass | null> {
  const res = await bridge("redeem", { code })
  if (res.status === 401) return null
  if (!res.ok) throw new Error("Beta invitations are unavailable")
  const value = await res.json()
  if (
    typeof value.invitationId !== "string" ||
    !/^[a-z0-9]{20,32}$/.test(value.invitationId) ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt <= Date.now()
  )
    throw new Error("Invalid beta grant")

  return value
}

export async function hasBetaAccess(
  cookie: string | undefined
): Promise<boolean> {
  const pass = readBetaPass(cookie)
  if (!pass) return false
  try {
    const res = await bridge("validate", { invitationId: pass.invitationId })

    return res.ok && (await res.json()).valid === true
  } catch {
    return false
  }
}
