import "server-only"

import { isSubmissionType, MODERATION_QUEUES } from "@repo/access"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { requireCapability } from "./access-server"
import { auth } from "./auth"
import { isDocumentIdParam, readJsonCapped } from "./bridge-params"
import { bridgeUserHeaders } from "./bridge-user-headers"
import { createRateLimiter, rateLimitResponse } from "./rate-limit"

/**
 * The `/api/moderation/*` routes: a signed-in Moderator's requests to
 * Strapi's community moderation API (`/api/content-moderation/moderation/*`).
 * Each request needs `moderate.queue` in the session, counts against a
 * per-user limit (writes 30 a minute, reads 120, counted apart), forwards only the query parameters and body keys its route
 * allows, and carries the caller's identity from the session, never from the
 * request. Strapi re-checks the caller's Moderation Scopes on every call and
 * its status and body come back unchanged.
 */

const STRAPI = () => process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const BASE = "/api/content-moderation/moderation"

/** The largest JSON body a moderation PUT accepts (a note is ≤ 2,000 chars). */
export const MAX_BODY_BYTES = 16 * 1024

// Per user, each on its own key: decisions (PUT) 30 a minute; reads (GET)
// 120 a minute, since paging and filtering the queue cost one read each.
const limiters = {
  PUT: createRateLimiter({
    name: "moderation-write",
    max: 30,
    windowMs: 60_000,
  }),
  GET: createRateLimiter({
    name: "moderation-read",
    max: 120,
    windowMs: 60_000,
  }),
}

/** Whether one query value may be forwarded. */
export type ParamRule = (v: string) => boolean

const oneOf =
  (allowed: readonly string[]): ParamRule =>
  (v) =>
    allowed.includes(v)
const intIn =
  (min: number, max: number): ParamRule =>
  (v) =>
    /^\d{1,4}$/.test(v) && Number(v) >= min && Number(v) <= max
const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/

/** `GET /moderation/submissions`: Strapi's list parameters and its limits. */
export const SUBMISSION_LIST_PARAMS: Record<string, ParamRule> = {
  status: oneOf(["pending", "needs_info", "decided"]),
  queue: oneOf(MODERATION_QUEUES),
  type: (v) => isSubmissionType(v),
  locale: (v) => LOCALE_PATTERN.test(v),
  q: (v) => v.length > 0 && v.length <= 100,
  page: intIn(1, 500),
  pageSize: intIn(1, 50),
}

/** `GET /moderation/relation-labels`. */
export const RELATION_LABEL_PARAMS: Record<string, ParamRule> = {
  type: oneOf(["services", "amenities", "accessibility"]),
}

export type ProxyOptions = {
  /** Path under `/api/content-moderation/moderation/`. */
  path: string
  method?: "GET" | "PUT"
  /** The query parameters forwarded, each with its own check. */
  params?: Record<string, ParamRule>
  /** Path ids to validate as Strapi documentIds (400 otherwise). */
  ids?: string[]
  /** For a PUT: the body keys forwarded; every other key is dropped. */
  bodyKeys?: readonly string[]
}

type SessionUser = {
  id: string
  email: string
  name?: string | null
  capabilities?: unknown
}

async function sessionUser(): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    return (session?.user as SessionUser | undefined) ?? null
  } catch {
    return null
  }
}

function forwardedQuery(
  req: Request,
  rules: Record<string, ParamRule> = {}
): URLSearchParams {
  const incoming = new URL(req.url).searchParams
  const out = new URLSearchParams()
  for (const [key, ok] of Object.entries(rules)) {
    const v = incoming.get(key)
    if (v !== null && ok(v)) out.set(key, v)
  }

  return out
}

function pick(body: unknown, keys: readonly string[]): Record<string, unknown> {
  const src =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}
  const out: Record<string, unknown> = {}
  for (const k of keys) if (k in src) out[k] = src[k]

  return out
}

/** Strapi's answer as it came: same status, JSON body (or an error). */
async function passThrough(res: Response): Promise<Response> {
  const text = await res.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { error: { status: res.status, message: "Unexpected response." } }
  }

  return NextResponse.json(body, {
    status: res.status,
    headers: { "Cache-Control": "no-store" },
  })
}

/** One `/api/moderation/*` request, checked and forwarded to Strapi. */
export async function proxyModeration(
  req: Request,
  opts: ProxyOptions
): Promise<Response> {
  const user = await sessionUser()
  const denied = requireCapability(user, "moderate.queue")
  if (denied || !user) return denied ?? new Response(null, { status: 401 })

  if (!process.env.STRAPI_BRIDGE_SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const method = opts.method ?? "GET"
  const limit = await limiters[method].check(user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  if (opts.ids?.some((id) => !isDocumentIdParam(id)))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  let body: string | undefined
  if (method === "PUT") {
    const parsed = await readJsonCapped(req, MAX_BODY_BYTES)
    if (!parsed.ok)
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: parsed.status }
      )
    body = JSON.stringify(pick(parsed.body, opts.bodyKeys ?? []))
  }

  const url = new URL(`${STRAPI()}${BASE}/${opts.path}`)
  url.search = forwardedQuery(req, opts.params).toString()

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...bridgeUserHeaders(user),
      },
      body,
      cache: "no-store",
    })

    return await passThrough(res)
  } catch {
    return NextResponse.json(
      { error: "The moderation service is unavailable." },
      { status: 502 }
    )
  }
}

/**
 * A moderation read for a server component, as the signed-in user (the
 * same Strapi routes the proxies call). `status` 0 means Strapi was
 * unreachable or the bridge isn't configured.
 */
export async function fetchModeration<T>(
  user: { id: string; email: string; name?: string | null },
  path: string
): Promise<{ status: number; body: T | null }> {
  if (!process.env.STRAPI_BRIDGE_SECRET) return { status: 0, body: null }
  try {
    const res = await fetch(`${STRAPI()}${BASE}/${path}`, {
      headers: bridgeUserHeaders(user),
      cache: "no-store",
    })
    const body = (await res.json().catch(() => null)) as T | null

    return { status: res.status, body }
  } catch {
    return { status: 0, body: null }
  }
}
