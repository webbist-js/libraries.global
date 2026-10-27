import "server-only"
import { SESSION_PROFILE_MAX_CLAIMS, type StaffAction } from "@repo/access"
import { revalidateTag } from "next/cache"
import { headers } from "next/headers"

import {
  requireEntitlement,
  requireEntitlementForLibrary,
  requireStaff,
  staffLibrariesOf,
  type StaffLibrarySummary,
} from "./access-server"
import { auth } from "./auth"
import { isDocumentIdParam, readJsonCapped } from "./bridge-params"
import { bridgeUserHeaders } from "./bridge-user-headers"
import type { ParamRule } from "./moderation-proxy"
import { createRateLimiter, rateLimitResponse } from "./rate-limit"
import { isSameOrigin, sameOriginResponse } from "./same-origin"

export type StaffProxyOptions = {
  base:
    | "library-staff"
    | "content-moderation/staff"
    | "mobile-libraries"
    | "access"
  path: string
  libraryDocumentId: string | null
  action: StaffAction | null
  /** A library-scoped feature, checked for `libraryDocumentId` (402). */
  entitlement?: "library.team" | "library.traffic"
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  params?: Record<string, ParamRule>
  bodyKeys?: readonly string[]
  limiter: "read" | "write" | "publish" | "invite" | "report" | "notice"
}

const limits = {
  read: createRateLimiter({
    name: "staff-read",
    max: 120,
    windowMs: 60_000,
  }),

  write: createRateLimiter({
    name: "staff-write",
    max: 30,
    windowMs: 60_000,
  }),

  publish: createRateLimiter({
    name: "staff-publish",
    max: 60,
    windowMs: 3_600_000,
  }),

  invite: createRateLimiter({
    name: "staff-invite",
    max: 20,
    windowMs: 86_400_000,
  }),

  report: createRateLimiter({
    name: "staff-report",
    max: 5,
    windowMs: 86_400_000,
  }),

  notice: createRateLimiter({
    name: "staff-notice",
    max: 20,
    windowMs: 3_600_000,
  }),
}

const noStoreHeaders = {
  "Cache-Control": "no-store",
} as const

function staffServiceUnavailableResponse(): Response {
  return Response.json(
    { error: "The staff service is unavailable." },
    {
      status: 502,
      headers: noStoreHeaders,
    }
  )
}

/**
 * Convert a Strapi bridge response into a response suitable for returning
 * to the browser.
 *
 * The bridge API is expected to return JSON, apart from 204 responses.
 * Invalid upstream JSON is treated as a bridge failure rather than allowing
 * a parsing exception to escape.
 */
async function proxyResponse(response: Response): Promise<Response> {
  if (response.status === 204) {
    return new Response(null, {
      status: 204,
      headers: noStoreHeaders,
    })
  }

  try {
    const body = await response.json()

    return Response.json(body, {
      status: response.status,
      headers: noStoreHeaders,
    })
  } catch {
    return staffServiceUnavailableResponse()
  }
}

export async function proxyStaff(
  req: Request,
  opts: StaffProxyOptions
): Promise<Response> {
  /*
   * Keep authentication based on the Next.js request context rather than
   * changing this to req.headers. Although either normally works inside a
   * route handler, retaining the existing behaviour makes this safe as a
   * drop-in replacement for current callers.
   */
  const session = await auth.api
    .getSession({
      headers: await headers(),
    })
    .catch(() => null)

  if (!session?.user) {
    return Response.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: noStoreHeaders,
      }
    )
  }

  let user = session.user

  /*
   * Library-scoped authorization.
   *
   * Keep the existing "seeTeam" fallback for compatibility with current
   * callers. A future stricter version should make `action` mandatory for
   * library-scoped routes at the type level.
   */
  if (opts.libraryDocumentId !== null) {
    if (!isDocumentIdParam(opts.libraryDocumentId)) {
      return Response.json(
        { error: "Invalid id" },
        {
          status: 400,
          headers: noStoreHeaders,
        }
      )
    }

    let denied = requireStaff(
      user,
      opts.libraryDocumentId,
      opts.action ?? "seeTeam"
    )

    if (
      denied?.status === 404 &&
      Array.isArray(user.staffLibraries) &&
      user.staffLibraries.length >= SESSION_PROFILE_MAX_CLAIMS
    ) {
      const target = await resolveTargetStaff(user, opts.libraryDocumentId)
      if (target) {
        user = withTargetStaff(user, target)
        denied = requireStaff(
          user,
          opts.libraryDocumentId,
          opts.action ?? "seeTeam"
        )
      }
    }

    if (denied) return denied
  }

  /*
   * Entitlement checking.
   *
   * The existing behaviour supports both library-scoped and global
   * entitlement checks, so retain that behaviour for drop-in compatibility.
   */
  if (opts.entitlement) {
    const denied = opts.libraryDocumentId
      ? requireEntitlementForLibrary(
          user,
          opts.entitlement,
          opts.libraryDocumentId
        )
      : requireEntitlement(user, opts.entitlement)

    if (denied) return denied
  }

  /*
   * opts.method remains authoritative for compatibility with existing route
   * definitions. A stricter future version could verify req.method against
   * this configuration and return 405 when they disagree.
   */
  const method = opts.method ?? "GET"

  /*
   * Protect all state-changing requests against cross-origin submission.
   */
  if (
    method !== "GET" &&
    !isSameOrigin(
      req,
      process.env.APP_PUBLIC_URL ?? process.env.BETTER_AUTH_URL
    )
  ) {
    return sameOriginResponse()
  }

  /*
   * The invite limiter remains scoped by both user and library, matching the
   * existing behaviour. Other limiter instances are already separate, so the
   * limiter name does not need to be included in their keys.
   */
  const rateLimitKey =
    opts.limiter === "invite" ? `${user.id}:${opts.libraryDocumentId}` : user.id

  const limit = await limits[opts.limiter].check(rateLimitKey)

  if (!limit.ok) {
    return rateLimitResponse(limit)
  }

  /*
   * bridgeUserHeaders() is expected to authenticate the Next.js -> Strapi
   * bridge using STRAPI_BRIDGE_SECRET. Retain the explicit configuration
   * guard so a missing secret cannot result in an unauthenticated bridge
   * request.
   */
  if (!process.env.STRAPI_BRIDGE_SECRET) {
    return Response.json(
      { error: "Bridge not configured" },
      {
        status: 503,
        headers: noStoreHeaders,
      }
    )
  }

  let body: string | undefined

  if (!["GET", "DELETE"].includes(method)) {
    const parsed = await readJsonCapped(req, 220_000)

    if (!parsed.ok) {
      return Response.json(
        { error: "Invalid request body" },
        {
          status: parsed.status,
          headers: noStoreHeaders,
        }
      )
    }

    const value = parsed.body

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return Response.json(
        { error: "Invalid request body" },
        {
          status: 400,
          headers: noStoreHeaders,
        }
      )
    }

    /*
     * Preserve the existing allowlist behaviour exactly:
     *
     * - configured bodyKeys -> only those keys are forwarded
     * - omitted bodyKeys    -> an empty object is forwarded
     *
     * Although the latter is somewhat surprising, changing it to "allow all"
     * would weaken the security boundary and could change existing endpoints.
     */
    const allowedBodyKeys = opts.bodyKeys

    body = JSON.stringify(
      Object.fromEntries(
        Object.entries(value).filter(([key]) => allowedBodyKeys?.includes(key))
      )
    )
  }

  const strapiBaseUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

  const url = new URL(`${strapiBaseUrl}/api/${opts.base}/${opts.path}`)

  /*
   * Parse the incoming URL once rather than once per parameter.
   *
   * Preserve the existing behaviour for invalid query values: unsupported or
   * invalid values are simply not forwarded to Strapi.
   */
  const requestSearchParams = new URL(req.url).searchParams

  for (const [key, valid] of Object.entries(opts.params ?? {})) {
    const value = requestSearchParams.get(key)

    if (value !== null && valid(value)) {
      url.searchParams.set(key, value)
    }
  }

  let response: Response

  /*
   * Keep the network request in its own try/catch.
   *
   * This is deliberately separate from cache invalidation and response
   * parsing so those operations cannot make a successful Strapi mutation
   * appear to have failed.
   */
  try {
    response = await fetch(url, {
      method,
      body,
      headers: {
        ...bridgeUserHeaders(user),
        "Content-Type": "application/json",
        "X-Ba-Email-Verified": String(user.emailVerified === true),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return staffServiceUnavailableResponse()
  }

  /*
   * Cache invalidation is secondary to the mutation itself.
   *
   * Previously, a revalidateTag() failure would be caught by the outer fetch
   * try/catch and returned to the browser as a 502 even though Strapi had
   * already completed the mutation. A client retry could therefore perform
   * the operation twice.
   *
   * Cache invalidation failure should be observable server-side, but must not
   * rewrite the outcome of an already-successful mutation.
   */
  if (response.ok && method !== "GET" && opts.libraryDocumentId) {
    try {
      revalidateTag("library", { expire: 0 })
      revalidateTag(`mobile:${opts.libraryDocumentId}`, { expire: 0 })
    } catch (error) {
      console.error("Failed to revalidate staff proxy cache tags", {
        libraryDocumentId: opts.libraryDocumentId,
        base: opts.base,
        path: opts.path,
        error,
      })
    }
  }

  return proxyResponse(response)
}

export async function fetchStaff<T>(
  user: {
    id: string
    email: string
    name?: string | null
  },
  path: string,
  base = "library-staff"
): Promise<{
  status: number
  body: T | null
}> {
  if (!process.env.STRAPI_BRIDGE_SECRET) {
    return {
      status: 0,
      body: null,
    }
  }

  try {
    const response = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/${base}/${path}`,
      {
        headers: bridgeUserHeaders(user),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    )

    return {
      status: response.status,
      body: (await response.json().catch(() => null)) as T | null,
    }
  } catch {
    return {
      status: 0,
      body: null,
    }
  }
}

/** One current authority read for a target outside the bounded session summary. */
export async function resolveTargetStaff(
  user: { id: string; email: string; name?: string },
  key: string
) {
  const response = await fetchStaff<StaffLibrarySummary>(
    user,
    `networks/target?key=${encodeURIComponent(key)}`,
    "access"
  )

  return response.status === 200 && response.body ? response.body : null
}
export function withTargetStaff<
  T extends { capabilities?: unknown; claimedLibraryIds?: unknown },
>(user: T, target: StaffLibrarySummary) {
  const staffLibraries = [
    target,
    ...staffLibrariesOf(user).filter((row) => row.id !== target.id),
  ]
  const claims = Array.isArray(user.claimedLibraryIds)
    ? user.claimedLibraryIds
    : []
  const capabilities = Array.isArray(user.capabilities) ? user.capabilities : []

  return {
    ...user,
    staffLibraries,
    claimedLibraryIds: [...new Set([...claims, target.id])],
    capabilities: [...new Set([...capabilities, "staff.area"])],
  }
}
