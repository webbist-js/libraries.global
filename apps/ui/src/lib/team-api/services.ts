import "server-only"

import { BillingError } from "@/lib/billing/config"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { LIVE_LOCALES } from "@/lib/live-locales"

import { API_OFFER_LIMITS } from "./config"
import { bridgeFailure, resourceBridge, strictQuery } from "./resources"

export const SERVICE_TYPES = [
  "library_service",
  "university_system",
  "consortium",
] as const
const PLACE_SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/

/** A service ref is the service's stable CMS document id; slugs may change. */
export const isServiceRef = (value: unknown): value is string =>
  typeof value === "string" && isDocumentIdParam(value)

function locale(incoming: URLSearchParams) {
  const value = incoming.get("locale") ?? "en"
  if (!LIVE_LOCALES.includes(value))
    throw new BillingError("locale_unavailable", 400)

  return value
}
function page(incoming: URLSearchParams) {
  const limit = incoming.get("limit") ?? "50"
  if (
    !/^\d{1,3}$/.test(limit) ||
    Number(limit) < 1 ||
    Number(limit) > API_OFFER_LIMITS.pageSize
  )
    throw new BillingError("invalid_limit", 400)
  const after = incoming.get("after") ?? undefined
  if (after !== undefined && !isDocumentIdParam(after))
    throw new BillingError("invalid_cursor", 400)

  return { limit, after }
}

/** GET /api/v1/services: published services and networks, keyset by ref. */
export async function apiServices(request: Request, maximum: number) {
  const incoming = strictQuery(request, [
    "locale",
    "limit",
    "after",
    "serviceType",
    "country",
  ])
  const serviceType = incoming.get("serviceType") ?? undefined
  if (
    serviceType !== undefined &&
    !(SERVICE_TYPES as readonly string[]).includes(serviceType)
  )
    throw new BillingError("invalid_service_type", 400)
  const country = incoming.get("country") ?? undefined
  if (country !== undefined && !PLACE_SLUG.test(country))
    throw new BillingError("invalid_country", 400)
  const result = await resourceBridge("access", "api/services", {
    query: {
      locale: locale(incoming),
      ...page(incoming),
      serviceType,
      country,
    },
    maximum,
  })
  if (result.status !== 200) bridgeFailure(result, {})

  return result.body
}

/** GET /api/v1/services/{ref} and /api/v1/services/{ref}/libraries. */
export async function apiService(
  request: Request,
  maximum: number,
  ref: string,
  members = false
) {
  if (!isServiceRef(ref)) throw new BillingError("record_not_found", 404)
  const incoming = strictQuery(
    request,
    members ? ["locale", "limit", "after"] : ["locale"]
  )
  const result = await resourceBridge(
    "access",
    `api/services/${encodeURIComponent(ref)}${members ? "/libraries" : ""}`,
    {
      query: {
        locale: locale(incoming),
        ...(members ? page(incoming) : {}),
      },
      maximum,
    }
  )
  if (result.status !== 200) bridgeFailure(result, {})

  return result.body
}
