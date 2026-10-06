import "server-only"

import { validateFeedValues } from "@repo/shared-data"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { requireCapability } from "./access-server"
import { auth } from "./auth"
import { isDocumentIdParam, readJsonCapped } from "./bridge-params"
import { bridgeUserHeaders } from "./bridge-user-headers"
import { createRateLimiter, rateLimitResponse } from "./rate-limit"

/**
 * The `/api/contribute/event-feeds/*` routes: a claimant's requests to
 * Strapi's Event Feed API (`/api/events/feeds*`). Each needs `events.feed`,
 * a library among the session's claims when one is named, and a per-user
 * limit (writes 10 an hour, tests 20 an hour, reads 120 a minute). Bodies
 * are capped at 16 KB, reduced to their allowed keys, never logged, and
 * values are never echoed. Strapi re-checks every claim.
 */

const STRAPI = () => process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const MAX_BODY = 16 * 1024
const BODY_KEYS = [
  "libraryDocumentId",
  "provider",
  "values",
  "organizationId",
] as const

const limiters = {
  write: createRateLimiter({
    name: "event-feed-write",
    max: 10,
    windowMs: 60 * 60_000,
  }),
  test: createRateLimiter({
    name: "event-feed-test",
    max: 20,
    windowMs: 60 * 60_000,
  }),
  read: createRateLimiter({
    name: "event-feed-read",
    max: 120,
    windowMs: 60_000,
  }),
}

type User = {
  id: string
  email: string
  name?: string | null
  capabilities?: unknown
  claimedLibraryIds?: unknown
}

async function sessionUser(): Promise<User | null> {
  try {
    const s = await auth.api.getSession({ headers: await headers() })

    return (s?.user as User | undefined) ?? null
  } catch {
    return null
  }
}

const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export type ProxyEventFeedOptions = {
  method: "GET" | "POST" | "PUT" | "DELETE"
  /** Path under /api/events/, e.g. `feeds` or `feeds/<id>/pause`. */
  path: string
  kind: "read" | "write" | "test"
  /** The body names a library that must be among the session's claims. */
  libraryFromBody?: boolean
  /** Pre-check `values` against the registry (`provider` from the body). */
  validateValues?: "body" | "none"
}

export async function proxyEventFeed(
  req: Request,
  opts: ProxyEventFeedOptions
): Promise<Response> {
  const user = await sessionUser()
  const denied = requireCapability(user, "events.feed")
  if (denied || !user) return denied ?? json({ error: "Sign in first" }, 401)
  if (!process.env.STRAPI_BRIDGE_SECRET)
    return json({ error: "Bridge not configured" }, 500)

  const limit = await limiters[opts.kind].check(user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  for (const seg of opts.path.split("/").slice(1, 2))
    if (seg && seg !== "test" && seg !== "providers" && !isDocumentIdParam(seg))
      return json({ error: "Invalid id" }, 400)

  let body: string | undefined
  if (opts.method === "POST" || opts.method === "PUT") {
    const parsed = await readJsonCapped(req, MAX_BODY)
    if (!parsed.ok)
      return json({ error: "Invalid request body" }, parsed.status)
    const raw = (parsed.body ?? {}) as Record<string, unknown>
    const picked = Object.fromEntries(
      BODY_KEYS.filter((k) => k in raw).map((k) => [k, raw[k]])
    )
    if (opts.libraryFromBody) {
      const claims = Array.isArray(user.claimedLibraryIds)
        ? (user.claimedLibraryIds as string[])
        : []
      if (
        typeof picked.libraryDocumentId !== "string" ||
        !claims.includes(picked.libraryDocumentId)
      )
        return json(
          {
            error: {
              status: 403,
              name: "not_claimed",
              message: "You haven't claimed this library.",
            },
          },
          403
        )
    }
    if (opts.validateValues === "body") {
      const r = validateFeedValues(picked.provider, picked.values)
      if (!r.ok)
        return json(
          {
            error: {
              status: 400,
              name: "invalid_values",
              message: r.error,
              field: r.field,
            },
          },
          400
        )
    }
    body = JSON.stringify(picked)
  }

  try {
    const res = await fetch(`${STRAPI()}/api/events/${opts.path}`, {
      method: opts.method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...bridgeUserHeaders(user),
      },
      body,
      cache: "no-store",
    })
    const text = await res.text()

    return new NextResponse(text || null, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return json({ error: "The event feed service is unavailable." }, 502)
  }
}

/** RSC read of the user's feeds (same Strapi route as the proxy). */
export async function fetchEventFeeds<T>(
  user: User,
  path = "feeds"
): Promise<{ status: number; body: T | null }> {
  if (!process.env.STRAPI_BRIDGE_SECRET) return { status: 0, body: null }
  try {
    const res = await fetch(`${STRAPI()}/api/events/${path}`, {
      headers: bridgeUserHeaders(user),
      cache: "no-store",
    })

    return {
      status: res.status,
      body: (await res.json().catch(() => null)) as T | null,
    }
  } catch {
    return { status: 0, body: null }
  }
}

/** RSC read of the provider registry and OAuth availability. */
export async function fetchEventFeedProviders(user: User) {
  return fetchEventFeeds<{
    data: { providers: unknown[]; oauth: { eventbrite: boolean } }
  }>(user, "feeds/providers")
}
