import "server-only"

import { isLibraryEntityRef } from "@repo/shared-data"
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

import { apiMonth } from "./config"
import {
  findApiKey,
  reserveApiRequest,
  finishApiRequest,
  type ApiReservation,
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
    locale: z.enum(["en", "cs", "fr"]).default("en"),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).max(10_000).default(0),
    country: z
      .string()
      .regex(/^[a-z0-9-]{1,100}$/)
      .optional(),
    region: z
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
  "_geo",
]
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Type": "application/json; charset=utf-8",
  Vary: "Authorization",
}

export function apiFailure(error: unknown) {
  const known = error instanceof BillingError
  const status = known ? error.status : 503
  const quota =
    known &&
    [
      "api_request_allowance_exhausted",
      "api_byte_allowance_exhausted",
    ].includes(error.code)
  const reset = apiMonth().end
  if (!known) console.error("[team-api] request failed")

  return Response.json(
    { error: { code: known ? error.code : "api_temporarily_unavailable" } },
    {
      status,
      headers: {
        ...headers,
        ...(status === 429
          ? {
              "Retry-After": quota
                ? String(
                    Math.max(
                      1,
                      Math.ceil((reset.getTime() - Date.now()) / 1000)
                    )
                  )
                : "60",
            }
          : {}),
        ...(quota ? { "X-API-Quota-Reset": reset.toISOString() } : {}),
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
  if (!LIVE_LOCALES.includes(query.locale))
    throw new BillingError("locale_unavailable", 400)
  const filters = [`locale = ${JSON.stringify(query.locale)}`]
  for (const [field, value] of Object.entries({
    country_slug: query.country,
    region_slug: query.region,
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

export async function apiLibraries(
  request: Request,
  maximum: number,
  entityRef?: string
) {
  if (entityRef !== undefined && !isLibraryEntityRef(entityRef))
    throw new BillingError("record_not_found", 404)
  const incoming = new URL(request.url).searchParams
  const allowed = new Set(["locale", "limit", "after", "country"])
  for (const key of incoming.keys())
    if (!allowed.has(key) || incoming.getAll(key).length !== 1)
      throw new BillingError("invalid_query", 400)
  const locale = incoming.get("locale") ?? "en"
  if (!LIVE_LOCALES.includes(locale))
    throw new BillingError("locale_unavailable", 400)
  const limit = incoming.get("limit") ?? "50"
  if (!/^\d{1,3}$/.test(limit) || Number(limit) < 1 || Number(limit) > 100)
    throw new BillingError("invalid_limit", 400)
  const after = incoming.get("after"),
    country = incoming.get("country")
  if (after && !isDocumentIdParam(after))
    throw new BillingError("invalid_cursor", 400)
  if (country && !/^[a-z0-9-]{1,100}$/.test(country))
    throw new BillingError("invalid_country", 400)
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) throw new BillingError("api_records_unavailable")
  const url = new URL(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/access/api/libraries${entityRef !== undefined ? `/${encodeURIComponent(entityRef)}` : ""}`
  )
  url.searchParams.set("locale", locale)
  url.searchParams.set("limit", limit)
  if (after) url.searchParams.set("after", after)
  if (country) url.searchParams.set("country", country)

  return upstreamJson(
    url.toString(),
    { headers: { "X-Service-Secret": secret } },
    maximum
  )
}

export async function serveTeamApi(
  pool: Pool,
  request: Request,
  scope: ApiScope,
  endpoint: string,
  work: (maximum: number) => Promise<unknown>
) {
  const started = Date.now()
  let reservation: ApiReservation | undefined
  try {
    if (!(await preauth.check(clientIp(request))).ok)
      throw new BillingError("api_rate_limit", 429)
    const authorization = request.headers.get("authorization") ?? ""
    if (!/^Bearer lg_api_[\w-]{43}$/.test(authorization))
      throw new BillingError("invalid_api_key", 401)
    const secret = authorization.slice(7)
    const key = await findApiKey(pool, secret)
    await checkApiTeamActive(key.team_id)
    reservation = await reserveApiRequest(pool, key, secret, scope, endpoint)
    const body = JSON.stringify(await work(reservation.budget))
    const bytes = Buffer.byteLength(body)
    if (bytes > reservation.budget)
      throw new BillingError("api_response_too_large", 502)
    // Commit successful usage before exposing the payload. A failed write cannot
    // deliver an unmetered response; its reservation is recovered by maintenance.
    await finishApiRequest(pool, reservation, 200, bytes, Date.now() - started)

    return new Response(body, {
      headers: {
        ...headers,
        "X-Request-Id": reservation.id,
        "X-API-Requests-Remaining": String(reservation.remaining),
        "X-API-Quota-Reset": reservation.resetsAt,
      },
    })
  } catch (error) {
    if (reservation) {
      try {
        await finishApiRequest(
          pool,
          reservation,
          error instanceof BillingError ? error.status : 503,
          0,
          Date.now() - started
        )
      } catch {
        console.error("[team-api] accounting awaits reconciliation")
      }
    }

    return apiFailure(error)
  }
}
