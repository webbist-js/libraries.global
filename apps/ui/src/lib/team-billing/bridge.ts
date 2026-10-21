import "server-only"

import { BillingError } from "@/lib/billing/config"

/** This private API accepts only server-selected fields, never browser headers. */
export async function teamBillingBridge<T>(
  action: string,
  body: unknown
): Promise<T> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) throw new BillingError("team_service_unavailable")
  const response = await fetch(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/access/billing/${action}`,
    {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": secret,
      },
      body: JSON.stringify(body),
    }
  )
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new BillingError(
      typeof result?.error?.code === "string"
        ? result.error.code
        : "team_service_unavailable",
      [400, 403, 404, 409, 410].includes(response.status)
        ? response.status
        : 503
    )
  }

  return response.json() as Promise<T>
}
