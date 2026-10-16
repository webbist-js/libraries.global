import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { readJsonCapped } from "@/lib/bridge-params"
import { strapiServiceHeaders, userHeaders } from "@/lib/bridge-user-headers"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"

const ID =
  "(?:[a-z0-9]{20,32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})"
const ROUTES: Record<string, RegExp[]> = {
  GET: [
    /^subjects$/,
    /^threads$/,
    new RegExp(`^threads/${ID}$`),
    new RegExp(`^threads/${ID}/replies$`),
    new RegExp(`^records/(thread|reply)/${ID}/revisions$`),
    /^my\/records$/,
    /^moderation\/(revisions|reports)$/,
    new RegExp(`^moderation/threads/${ID}/audit$`),
  ],
  POST: [
    /^threads$/,
    new RegExp(`^threads/${ID}/replies$`),
    new RegExp(`^records/(thread|reply)/${ID}/(revisions|reports)$`),
  ],
  PUT: [
    new RegExp(`^threads/${ID}/subscription$`),
    new RegExp(`^moderation/(revisions|reports)/${ID}$`),
    new RegExp(`^moderation/records/(thread|reply)/${ID}$`),
  ],
}
const QUERY_KEYS = new Set([
  "subjectId",
  "targetUid",
  "targetId",
  "targetLocale",
  "language",
  "offset",
  "limit",
  "kind",
  "threadId",
  "recordId",
  "state",
])

export function discussionProxyPath(method: string, path: string[]) {
  const joined = path.join("/")

  return path.every((part) => !part.includes("/") && !part.includes("%")) &&
    ROUTES[method]?.some((route) => route.test(joined))
    ? joined
    : null
}

export async function proxyDiscussion(req: Request, path: string[]) {
  const route = discussionProxyPath(req.method, path)
  if (!route)
    return NextResponse.json(
      { error: "Unknown discussion route" },
      { status: 404 }
    )
  if (!process.env.STRAPI_BRIDGE_SECRET)
    return NextResponse.json(
      { error: "Discussion service unavailable" },
      { status: 503 }
    )
  const session = await auth.api.getSession({ headers: await headers() })
  if (
    !session?.user &&
    (req.method !== "GET" ||
      route.startsWith("my/") ||
      route.startsWith("moderation/"))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let body: string | undefined
  if (req.method !== "GET") {
    if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
      return sameOriginResponse()
    const parsed = await readJsonCapped(req, 96 * 1024)
    if (!parsed.ok)
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: parsed.status }
      )
    if (
      !parsed.body ||
      typeof parsed.body !== "object" ||
      Array.isArray(parsed.body)
    )
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      )
    body = JSON.stringify(parsed.body)
  }
  const query = new URL(req.url).searchParams
  const upstream = new URL(
    `/api/discussions/${route}`,
    process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  )
  let count = 0
  for (const [key, value] of query) {
    if (
      !QUERY_KEYS.has(key) ||
      value.length > 180 ||
      ++count > 15 ||
      upstream.searchParams.has(key)
    )
      return NextResponse.json(
        { error: "Invalid discussion query" },
        { status: 400 }
      )
    upstream.searchParams.set(key, value)
  }
  try {
    const response = await fetch(upstream, {
      method: req.method,
      headers: {
        ...strapiServiceHeaders(),
        ...(session?.user ? userHeaders(session.user) : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 204)
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "private, no-store" },
      })
    const json: unknown = await response.json()

    return NextResponse.json(json, {
      status: response.status,
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch {
    return NextResponse.json(
      { error: "Discussion service unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    )
  }
}
