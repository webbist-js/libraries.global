import { createHmac } from "node:crypto"

import {
  parseAtlasNetworkReachRequest,
  parseAtlasScope,
  parseAtlasNetworkReachResult,
  type AtlasNetworkReachRequest,
} from "@repo/shared-data"

import { requireEntitlement } from "@/lib/access-server"
import { auth } from "@/lib/auth"
import { readJsonCapped, readTextCapped } from "@/lib/bridge-params"
import { createRateLimiter } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 30
const requests = createRateLimiter({
  name: "atlas-network-reach",
  max: 60,
  windowMs: 60_000,
})

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  const denied = requireEntitlement(session?.user, "atlas.analysis")
  if (denied) return denied
  const rate = await requests.check(session!.user.id)
  if (!rate.ok)
    return Response.json(
      {
        error: "Please wait before checking Reach again.",
        code: "REACH_RATE_LIMIT",
      },
      {
        status: 429,
        headers: {
          "retry-after": String(rate.retryAfterSeconds),
          "cache-control": "no-store",
        },
      }
    )
  if (process.env.ATLAS_QUERY_ENABLED !== "true")
    return Response.json({ error: "Atlas is unavailable" }, { status: 503 })
  const input = await readJsonCapped(req, 4096)
  if (!input.ok)
    return Response.json(
      { error: "Invalid Reach JSON" },
      { status: input.status }
    )
  let request
  try {
    request = parseAtlasNetworkReachRequest(input.body)
  } catch {
    return Response.json({ error: "Invalid Reach request" }, { status: 400 })
  }
  const limits = (session!.user as { limits?: Record<string, unknown> }).limits
  const hourlyLimit = limits?.analysisRunsPerHour
  if (
    !Number.isInteger(hourlyLimit) ||
    Number(hourlyLimit) < 1 ||
    Number(hourlyLimit) > 100
  )
    return Response.json(
      { error: "Analysis allowance is unavailable" },
      { status: 503 }
    )
  try {
    const secret = process.env.STRAPI_BRIDGE_SECRET
    const token = process.env.ATLAS_SERVICE_TOKEN
    const host = process.env.STRAPI_URL
    if (!secret || !token || !host)
      throw new Error("Atlas bridge is not configured")
    const userKey = createHmac("sha256", secret)
      .update(`reach:${session!.user.id}`)
      .digest("hex")
    const response = await fetch(new URL("/api/atlas/network-reach", host), {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-service-secret": secret,
        "x-atlas-token": token,
      },
      body: JSON.stringify({ request, userKey, hourlyLimit }),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(25000)]),
    })
    const text = await readTextCapped(response, 3 * 1024 * 1024)
    if (text === null) throw new Error("Reach response exceeds budget")
    const result = JSON.parse(text)
    if (response.ok) validateResponse(result, request)
    const status = backendStatus(response)

    return Response.json(
      response.ok
        ? result
        : {
            error:
              status === 429
                ? "Hourly analysis allowance reached. Try again later."
                : "Reach is temporarily unavailable.",
          },
      {
        status,
        headers: {
          "cache-control": "no-store",
          ...(status === 202 ? { "retry-after": "3" } : {}),
        },
      }
    )
  } catch {
    return Response.json(
      { error: "Reach is temporarily unavailable" },
      { status: 503 }
    )
  }
}

function validateResponse(input: unknown, request: AtlasNetworkReachRequest) {
  const value = input as Record<string, unknown>
  if (
    !value ||
    typeof value !== "object" ||
    value.schemaVersion !== 1 ||
    value.networkId !== request.networkId ||
    (request.areaCode !== undefined && value.areaCode !== request.areaCode) ||
    value.mode !== request.mode
  )
    throw new Error("Mismatched Reach response")
  if (value.state === "ready" || value.state === "partial") {
    parseAtlasNetworkReachResult(value)
    if (
      JSON.stringify(parseAtlasScope(value.scope)) !==
      JSON.stringify(parseAtlasScope(request.scope))
    )
      throw new Error("Mismatched Reach filters")

    return
  }
  if (
    ![
      "pending",
      "unsupported",
      "unroutable",
      "missing_population",
      "failed",
    ].includes(String(value.state))
  )
    throw new Error("Invalid Reach state")
}

function backendStatus(response: Response) {
  if (response.ok) return response.status

  return [400, 404, 429].includes(response.status) ? response.status : 503
}
