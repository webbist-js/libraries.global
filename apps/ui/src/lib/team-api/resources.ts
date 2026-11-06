import "server-only"

import { BillingError } from "@/lib/billing/config"
import { readTextCapped } from "@/lib/bridge-params"

import { apiFailure } from "./gateway"

/**
 * Feature flags for the service, submission and analysis resources. Each is
 * a server environment variable that defaults to off. A disabled resource
 * answers 404 `resource_not_enabled` before any key or ledger work; an
 * enabled one still passes the full gateway (key, coverage, scope, limits,
 * ledger). A flag never bypasses authorisation or accounting.
 */
export const API_RESOURCE_FLAGS = {
  services: "API_SERVICE_READS_ENABLED",
  submissions: "API_SUBMISSIONS_ENABLED",
  analysis: "API_ANALYSIS_ENABLED",
  networkReach: "API_NETWORK_REACH_ENABLED",
} as const
export type ApiResource = keyof typeof API_RESOURCE_FLAGS

export function apiResourceEnabled(resource: ApiResource) {
  return process.env[API_RESOURCE_FLAGS[resource]] === "true"
}

/** Wrap a route handler so a disabled resource is not callable at all. */
export function flaggedRoute<Args extends unknown[]>(
  resource: ApiResource,
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args) =>
    apiResourceEnabled(resource)
      ? handler(...args)
      : apiFailure(new BillingError("resource_not_enabled", 404))
}

/** Reject any query key outside `allowed`, or a repeated key. */
export function strictQuery(request: Request, allowed: readonly string[]) {
  const incoming = new URL(request.url).searchParams
  for (const key of incoming.keys())
    if (!allowed.includes(key) || incoming.getAll(key).length !== 1)
      throw new BillingError("invalid_query", 400)

  return incoming
}

/** A documented refusal with safe detail (a field name or the caller's own ids). */
export class ApiDetailError extends BillingError {
  constructor(
    code: string,
    status: number,
    readonly detail: Record<string, unknown>
  ) {
    super(code, status)
  }
}

export type BridgeResult<T> = { status: number; body: T | null }

/**
 * One private CMS bridge call: service secret, no user identity, no
 * redirects, a timeout and a byte cap on the response. `plugin` selects the
 * Access or Content Moderation machine routes.
 */
export async function resourceBridge<T>(
  plugin: "access" | "content-moderation",
  path: string,
  options: {
    method?: "GET" | "POST"
    query?: Record<string, string | undefined>
    body?: unknown
    maximum: number
    timeoutMs?: number
    failure?: string
  }
): Promise<BridgeResult<T>> {
  const failure = options.failure ?? "api_records_unavailable"
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) throw new BillingError(failure)
  const url = new URL(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/${plugin}/${path}`
  )
  for (const [key, value] of Object.entries(options.query ?? {}))
    if (value !== undefined) url.searchParams.set(key, value)
  let response: Response
  try {
    response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      headers: {
        "X-Service-Secret": secret,
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    })
  } catch {
    throw new BillingError("api_upstream_unavailable", 502)
  }
  const text = await readTextCapped(response, options.maximum)
  if (text === null) throw new BillingError("api_response_too_large", 502)
  let body: T | null = null
  try {
    body = text ? (JSON.parse(text) as T) : null
  } catch {
    body = null
  }

  return { status: response.status, body }
}

export const bridgeErrorCode = (body: unknown) => {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code

  return typeof code === "string" && /^[a-z_]{1,60}$/.test(code) ? code : null
}

/** Map a bridge refusal to the documented public error, else 502. */
export function bridgeFailure(
  result: BridgeResult<unknown>,
  allowed: Record<number, readonly string[]>
): never {
  const code = bridgeErrorCode(result.body)
  if (result.status === 404) throw new BillingError("record_not_found", 404)
  if (code && allowed[result.status]?.includes(code))
    throw new BillingError(code, result.status)
  if (result.status === 400) throw new BillingError("invalid_request", 400)
  if (result.status === 503)
    throw new BillingError(code ?? "api_upstream_unavailable", 503)
  throw new BillingError("api_upstream_unavailable", 502)
}
