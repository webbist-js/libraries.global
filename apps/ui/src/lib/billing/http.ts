import "server-only"

import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { authDbPool } from "@/lib/auth"
import { getSessionSSR } from "@/lib/auth-server"
import { sessionIsFresh } from "@/lib/fresh-auth"
import { isSameOrigin } from "@/lib/same-origin"

import { BillingError, billingConfig } from "./config"

export const billingJson = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function billingUser(
  req: Request,
  mutation = false,
  fresh = false
) {
  if (mutation && !isSameOrigin(req, billingConfig().origin))
    throw new BillingError("cross_site_request_refused", 403)
  const session = await getSessionSSR(await headers())
  if (!session?.user) throw new BillingError("sign_in_required", 401)
  if (!session.user.emailVerified)
    throw new BillingError("verified_account_required", 403)
  if (fresh && !sessionIsFresh(session.session))
    throw new BillingError("reauthentication_required", 403)
  // An atomic Postgres limiter holds across instances, unlike the app's in-memory limiter.
  const result = await authDbPool.query<{ hits: number }>(
    "insert into billing_rate_limits(key,hits,resets_at) values($1,1,now()+interval '1 minute') on conflict(key) do update set hits=case when billing_rate_limits.resets_at<=now() then 1 else billing_rate_limits.hits+1 end,resets_at=case when billing_rate_limits.resets_at<=now() then now()+interval '1 minute' else billing_rate_limits.resets_at end returning hits",
    [`${mutation ? "write" : "read"}:${session.user.id}`]
  )
  if ((result.rows[0]?.hits ?? 100) > (mutation ? 10 : 60))
    throw new BillingError("too_many_requests", 429)

  return session.user
}

export function billingFailure(error: unknown) {
  if (error instanceof BillingError)
    return billingJson(
      {
        error: error.code,
        ...(error.code === "reauthentication_required"
          ? { reauthUrl: "/auth/signin?callbackUrl=%2Fdevelopers" }
          : {}),
      },
      error.status
    )
  // Do not leak provider responses, SQL, addresses, identifiers or credentials.
  console.error("[billing] request failed")

  return billingJson({ error: "billing_temporarily_unavailable" }, 503)
}
