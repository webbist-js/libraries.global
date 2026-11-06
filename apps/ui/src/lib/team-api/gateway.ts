import "server-only"

import { isLibraryEntityRef, SUPPORTED_LOCALES } from "@repo/shared-data"
import type { Pool } from "pg"
import { z } from "zod"

import { BillingError } from "@/lib/billing/config"
import {
  readJsonCapped,
  readTextCapped,
  isDocumentIdParam,
} from "@/lib/bridge-params"
import { LIVE_LOCALES } from "@/lib/live-locales"
import { clientIp, createRateLimiter } from "@/lib/rate-limit"

import { API_OFFER_LIMITS } from "./config"
import {
  ApiRefusal,
  findApiKey,
  reserveApiRequest,
  finishApiRequest,
  type ApiReservation,
  type KeyRow,
} from "./store"
import { checkApiTeamActive } from "./team"
import type { ApiScope } from "./types"

// Pre-authentication abuse protection is separate from durable commercial quotas.
const preauth = createRateLimiter({
  name: "team-api-preauth",
  max: 300,
  windowMs: 60_000,
})

const Search = z
  .object({
    q: z.string().max(512).default(""),
    locale: z.enum(SUPPORTED_LOCALES).default("en"),
    limit: z.number().int().min(1).max(API_OFFER_LIMITS.pageSize).default(20),
    offset: z.number().int().min(0).max(10_000).default(0),
    country: z
      .string()
      .regex(/^[a-z0-9-]{1,100}$/)
      .optional(),
    region: z
      .string()
      .regex(/^[a-z0-9-]{1,100}$/)
      .optional(),
    area: z
      .string()
      .regex(/^[a-z0-9-]{1,100}$/)
      .optional(),
    libraryType: z.string().max(80).optional(),
    operationalStatus: z.string().max(40).optional(),
    near: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radius: z.number().min(1).max(100_000),
      })
      .strict()
      .optional(),
  })
  .strict()
const ATTRIBUTES = [
  "documentId",
  "name",
  "slug",
  "entityRef",
  "shortName",
  "summary",
  "libraryType",
  "operationalStatus",
  "city",
  "continent_slug",
  "country_slug",
  "country_name",
  "region_slug",
  "region_name",
  "area_slug",
  "area_name",
  "_geo",
]
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Type": "application/json; charset=utf-8",
  Vary: "Authorization",
}

/** Stable 429 codes; `Retry-After` is set whenever a retry can succeed. */
export const API_QUOTA_CODES = [
  "quota_requests",
  "quota_bytes",
  "quota_analysis",
  "overage_cap",
  "rate_limit",
  "concurrency_limit",
] as const

export function apiFailure(error: unknown) {
  const known = error instanceof BillingError
  const status = known ? error.status : 503
  if (!known) console.error("[api] request failed")
  const refusal = error instanceof ApiRefusal ? error : null

  // A refusal may carry safe, documented detail (a field name or the
  // caller's own ids); see submissions.ts.
  const detail =
    known &&
    "detail" in error &&
    error.detail &&
    typeof error.detail === "object"
      ? (error.detail as Record<string, unknown>)
      : {}

  return Response.json(
    {
      error: {
        ...detail,
        code: known ? error.code : "api_temporarily_unavailable",
      },
    },
    {
      status,
      headers: {
        ...headers,
        ...(refusal?.retryAfter
          ? { "Retry-After": String(refusal.retryAfter) }
          : status === 429
            ? { "Retry-After": "60" }
            : {}),
        ...(refusal?.resetsAt
          ? { "X-API-Quota-Reset": new Date(refusal.resetsAt).toISOString() }
          : {}),
      },
    }
  )
}

async function upstreamJson(
  url: string,
  options: RequestInit,
  maximum: number
) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
  })
  if (response.status === 404) throw new BillingError("record_not_found", 404)
  if (!response.ok) throw new BillingError("api_upstream_unavailable", 502)
  const text = await readTextCapped(response, maximum)
  if (text === null) throw new BillingError("api_response_too_large", 502)
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new BillingError("api_upstream_unavailable", 502)
  }
}

export async function apiSearch(request: Request, maximum: number) {
  const parsed = await readJsonCapped(request, 8192)
  if (!parsed.ok) throw new BillingError("invalid_search", parsed.status)
  const choice = Search.safeParse(parsed.body)
  if (!choice.success) throw new BillingError("invalid_search", 400)
  const query = choice.data
  // A region is unique within its country and an area within its region.
  if ((query.region && !query.country) || (query.area && !query.region))
    throw new BillingError("invalid_search", 400)
  if (!LIVE_LOCALES.includes(query.locale))
    throw new BillingError("locale_unavailable", 400)
  const filters = [`locale = ${JSON.stringify(query.locale)}`]
  for (const [field, value] of Object.entries({
    country_slug: query.country,
    region_slug: query.region,
    area_slug: query.area,
    libraryType: query.libraryType,
    operationalStatus: query.operationalStatus,
  })) {
    if (value) filters.push(`${field} = ${JSON.stringify(value)}`)
  }
  if (query.near)
    filters.push(
      `_geoRadius(${query.near.lat}, ${query.near.lng}, ${query.near.radius})`
    )
  const host = process.env.MEILISEARCH_HOST,
    key = process.env.MEILISEARCH_SEARCH_API_KEY
  if (!host || !key) throw new BillingError("api_search_unavailable")
  const data = await upstreamJson(
    `${host.replace(/\/$/, "")}/indexes/library/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query.q,
        limit: query.limit,
        offset: query.offset,
        filter: filters.join(" AND "),
        attributesToRetrieve: ATTRIBUTES,
      }),
    },
    maximum
  )
  const result = z
    .object({
      hits: z.array(z.record(z.string(), z.unknown())),
      estimatedTotalHits: z.number().optional(),
    })
    .safeParse(data)
  if (!result.success) throw new BillingError("api_upstream_unavailable", 502)

  // Re-project at the gateway as well; upstream settings cannot broaden the API.
  return {
    data: result.data.hits.map((hit) =>
      Object.fromEntries(
        ATTRIBUTES.filter((field) => field in hit).map((field) => [
          field,
          hit[field],
        ])
      )
    ),
    meta: {
      locale: query.locale,
      limit: query.limit,
      offset: query.offset,
      estimatedTotal: result.data.estimatedTotalHits ?? null,
      attribution:
        "Libraries Global contributors. Retrieve the Library record for its source licences.",
    },
  }
}

type Place = { country?: string; region?: string; area?: string }
const PLACE_SLUG = /^[a-z0-9-]{1,100}$/

function assertSingleAllowedKeys(
  incoming: URLSearchParams,
  allowed: Set<string>
) {
  for (const key of incoming.keys())
    if (!allowed.has(key) || incoming.getAll(key).length !== 1)
      throw new BillingError("invalid_query", 400)
}

/** The country, region and area filters, from the path or else the query. */
function libraryPlaceFilters(incoming: URLSearchParams, place?: Place) {
  const country = place?.country ?? incoming.get("country"),
    region = place?.region ?? incoming.get("region"),
    area = place?.area ?? incoming.get("area")
  if (country && !PLACE_SLUG.test(country))
    throw new BillingError("invalid_country", 400)
  if (
    (region && (!country || !PLACE_SLUG.test(region))) ||
    (area && (!region || !PLACE_SLUG.test(area)))
  )
    throw new BillingError("invalid_place", 400)

  return { country, region, area }
}

/**
 * The list, one record, or (with `place` from a /places path) the libraries
 * in a country, region or area. Query places need each level above them.
 */
export async function apiLibraries(
  request: Request,
  maximum: number,
  entityRef?: string,
  place?: Place
) {
  if (entityRef !== undefined && !isLibraryEntityRef(entityRef))
    throw new BillingError("record_not_found", 404)
  const incoming = new URL(request.url).searchParams
  assertSingleAllowedKeys(
    incoming,
    new Set(
      place
        ? ["locale", "limit", "after"]
        : ["locale", "limit", "after", "country", "region", "area"]
    )
  )
  const locale = incoming.get("locale") ?? "en"
  if (!LIVE_LOCALES.includes(locale))
    throw new BillingError("locale_unavailable", 400)
  const limit = incoming.get("limit") ?? "50"
  if (
    !/^\d{1,3}$/.test(limit) ||
    Number(limit) < 1 ||
    Number(limit) > API_OFFER_LIMITS.pageSize
  )
    throw new BillingError("invalid_limit", 400)
  const after = incoming.get("after")
  if (after && !isDocumentIdParam(after))
    throw new BillingError("invalid_cursor", 400)
  const { country, region, area } = libraryPlaceFilters(incoming, place)
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) throw new BillingError("api_records_unavailable")
  const url = new URL(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/access/api/libraries${entityRef !== undefined ? `/${encodeURIComponent(entityRef)}` : ""}`
  )
  url.searchParams.set("locale", locale)
  url.searchParams.set("limit", limit)
  if (after) url.searchParams.set("after", after)
  if (country) url.searchParams.set("country", country)
  if (region) url.searchParams.set("region", region)
  if (area) url.searchParams.set("area", area)

  return upstreamJson(
    url.toString(),
    { headers: { "X-Service-Secret": secret } },
    maximum
  )
}

/**
 * Countries with published libraries, a country's regions, or a region's
 * areas, each with a library count. Accepts only `locale` as a query.
 */
export async function apiPlaces(
  request: Request,
  maximum: number,
  place: { country?: string; region?: string }
) {
  const incoming = new URL(request.url).searchParams
  for (const key of incoming.keys())
    if (key !== "locale" || incoming.getAll(key).length !== 1)
      throw new BillingError("invalid_query", 400)
  const locale = incoming.get("locale") ?? "en"
  if (!LIVE_LOCALES.includes(locale))
    throw new BillingError("locale_unavailable", 400)
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) throw new BillingError("api_records_unavailable")
  const url = new URL(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/access/api/places`
  )
  url.searchParams.set("locale", locale)
  if (place.country) url.searchParams.set("country", place.country)
  if (place.region) url.searchParams.set("region", place.region)

  return upstreamJson(
    url.toString(),
    { headers: { "X-Service-Secret": secret } },
    maximum
  )
}

async function authorizeKeyOwner(pool: Pool, key: KeyRow) {
  if (!key.created_by) throw new BillingError("invalid_api_key", 401)
  try {
    await checkApiTeamActive(key.team_id, key.created_by)
  } catch (error) {
    if (error instanceof BillingError && error.code === "api_key_owner_removed")
      await pool.query(
        "update api_keys set revoked_at=coalesce(revoked_at,now()) where team_id=$1 and created_by=$2",
        [key.team_id, key.created_by]
      )
    throw error
  }
}

const RESULT = Symbol("api-result")
type ApiResultBody = {
  [RESULT]: true
  body: unknown
  status: 200 | 201 | 202
  credits?: number
}

/**
 * Wrap a handler's body to set a 201/202 status or settle fewer analysis
 * credits than reserved (for example a cached result: delivery units only).
 */
export function apiResult(
  body: unknown,
  options: { status?: 200 | 201 | 202; credits?: number } = {}
): ApiResultBody {
  return {
    [RESULT]: true,
    body,
    status: options.status ?? 200,
    credits: options.credits,
  }
}
const isResult = (value: unknown): value is ApiResultBody =>
  typeof value === "object" && value !== null && RESULT in value

export type ApiRequestOptions = {
  /** Key scope the route requires. */
  scope: ApiScope
  /** Usage label recorded per request, for example `services.list`. */
  endpoint: string
  /**
   * Analysis credits a synchronous operation may spend. Reserved with the
   * request under the same account/period lock and settled after success
   * (use `apiResult(body, { credits })` to settle fewer). Asynchronous jobs
   * use `reserveAnalysis` from `./analysis` instead.
   */
  analysisCredits?: number
}

export type ApiRequestContext = {
  request: Request
  /** Most UTF-8 JSON bytes the response may use (never above 128 KiB). */
  maximum: number
  /** The authenticated API account; never a signed-in user identity. */
  account: { teamId: string; keyId: string }
  /** Stable for this request; use it as a job or proposal idempotency suffix. */
  requestId: string
  /** Analysis credits reserved for this request. */
  credits: number
}

/**
 * The machine API pipeline: key authentication, current organiser check,
 * paid coverage, scope, per-minute and concurrency limits, then a ledger
 * reservation (1 request + max response bytes + analysis credits) before the
 * handler runs. Successful usage settles before the payload is returned; a
 * failure or oversized response refunds the reservation and delivers nothing.
 */
export async function serveApiRequest(
  pool: Pool,
  request: Request,
  options: ApiRequestOptions,
  work: (context: ApiRequestContext) => Promise<unknown>
) {
  const started = Date.now()
  let reservation: ApiReservation | undefined
  try {
    if (!(await preauth.check(clientIp(request))).ok)
      throw new ApiRefusal("rate_limit", 429, 60)
    const authorization = request.headers.get("authorization") ?? ""
    if (!/^Bearer lg_api_[\w-]{43}$/.test(authorization))
      throw new BillingError("invalid_api_key", 401)
    const secret = authorization.slice(7)
    const key = await findApiKey(pool, secret)
    await authorizeKeyOwner(pool, key)
    reservation = await reserveApiRequest(
      pool,
      key,
      secret,
      options.scope,
      options.endpoint,
      { analysisCredits: options.analysisCredits }
    )
    const output = await work({
      request,
      maximum: reservation.budget,
      account: { teamId: key.team_id, keyId: key.id },
      requestId: reservation.id,
      credits: reservation.credits,
    })
    const result = isResult(output) ? output : apiResult(output)
    const credits = result.credits ?? reservation.credits
    if (
      !Number.isSafeInteger(credits) ||
      credits < 0 ||
      credits > reservation.credits
    )
      throw new BillingError("api_operation_invalid", 500)
    const body = JSON.stringify(result.body)
    const bytes = Buffer.byteLength(body)
    if (bytes > reservation.budget)
      throw new BillingError("api_response_too_large", 502)
    // Commit successful usage before exposing the payload. A failed write cannot
    // deliver an unmetered response; maintenance recovers its reservation.
    await finishApiRequest(pool, reservation, {
      status: result.status,
      bytes,
      credits,
      duration: Date.now() - started,
    })
    const remaining = reservation.remaining

    return new Response(body, {
      status: result.status,
      headers: {
        ...headers,
        "X-Request-Id": reservation.id,
        "X-API-Requests-Remaining": String(remaining.requests),
        "X-API-Bytes-Remaining": String(
          remaining.bytes +
            (reservation.budget - Math.min(bytes, reservation.budget))
        ),
        "X-API-Analysis-Credits-Remaining": String(
          remaining.credits + (reservation.credits - credits)
        ),
        "X-API-Quota-Reset": reservation.resetsAt,
      },
    })
  } catch (error) {
    if (reservation) {
      try {
        await finishApiRequest(pool, reservation, {
          status: error instanceof BillingError ? error.status : 503,
          bytes: 0,
          duration: Date.now() - started,
        })
      } catch {
        console.error("[api] accounting awaits reconciliation")
      }
    }

    return apiFailure(error)
  }
}

/** @deprecated Use `withApiRequest`. Kept for the existing read routes. */
export function serveTeamApi(
  pool: Pool,
  request: Request,
  scope: ApiScope,
  endpoint: string,
  work: (maximum: number) => Promise<unknown>
) {
  return serveApiRequest(pool, request, { scope, endpoint }, (context) =>
    work(context.maximum)
  )
}

/**
 * Route helper for `/api/v1` handlers. Every route gets the same key
 * authentication, coverage, scope, rate/concurrency limits and ledger:
 *
 * ```ts
 * export const GET = withApiRequest(
 *   { scope: "services:read", endpoint: "services.list" },
 *   async ({ request, maximum, account }) => listServices(request, maximum)
 * )
 * export const POST = withApiRequest(
 *   { scope: "analysis:run", endpoint: "analysis.summary", analysisCredits: 5 },
 *   async ({ request, maximum }) => apiResult(await summary(request, maximum), { credits: 1 })
 * )
 * ```
 *
 * The handler returns a JSON-serialisable body (or `apiResult(...)`); throw
 * `BillingError(code, status)` for documented errors. Never read session
 * cookies or call session-only browser routes from a handler.
 */
export function withApiRequest<RouteContext = unknown>(
  options: ApiRequestOptions,
  handler: (context: ApiRequestContext, route: RouteContext) => Promise<unknown>
) {
  return async (request: Request, route: RouteContext) => {
    const { authDbPool } = await import("@/lib/auth")

    return serveApiRequest(authDbPool, request, options, (context) =>
      handler(context, route)
    )
  }
}
