import { NextResponse } from "next/server"
import { z } from "zod"

import { BETA_COOKIE, betaEnabled } from "@/lib/beta/access"
import { hasBetaAccess } from "@/lib/beta/invitations"
import { readJsonCapped } from "@/lib/bridge-params"
import {
  clientIp,
  createRateLimiter,
  rateLimitResponse,
} from "@/lib/rate-limit"

const INDEXES = new Set([
  "library",
  "blog-article",
  "wiki-article",
  "event",
  "mobile-stop",
])
const limiter = createRateLimiter({ name: "search", max: 120, windowMs: 60000 })
const query = z
  .object({
    q: z.string().max(2048).optional(),
    limit: z.number().int().min(0).max(2000).optional(),
    offset: z.number().int().min(0).max(100000).optional(),
    hitsPerPage: z.number().int().min(1).max(1000).optional(),
    page: z.number().int().min(1).max(10000).optional(),
  })
  .passthrough()
const json = (error: string, status: number) =>
  NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "private, no-store" } }
  )

export async function POST(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const pass = req.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${BETA_COOKIE}=`))
    ?.slice(BETA_COOKIE.length + 1)
  if (betaEnabled() && !(await hasBetaAccess(pass)))
    return json("Beta access required", 401)
  const path = (await params).path
  const single =
    path.length === 3 &&
    path[0] === "indexes" &&
    INDEXES.has(path[1]!) &&
    path[2] === "search"
  const multi = path.length === 1 && path[0] === "multi-search"
  if (!single && !multi) return json("Search endpoint not available", 404)
  const parsed = await readJsonCapped(req, 128 * 1024)
  if (!parsed.ok) return json("Invalid search", parsed.status)
  const schema = multi
    ? z
        .object({
          queries: z
            .array(
              query.extend({
                indexUid: z.string().refine((value) => INDEXES.has(value)),
              })
            )
            .min(1)
            .max(20),
        })
        .strict()
    : query
  const body = schema.safeParse(parsed.body)
  if (!body.success) return json("Invalid search", 400)
  const limit = await limiter.check(clientIp(req))
  if (!limit.ok) return rateLimitResponse(limit)
  const host = process.env.MEILISEARCH_HOST
  const key = process.env.MEILISEARCH_SEARCH_API_KEY
  if (!host || !key) return json("Search unavailable", 503)
  try {
    const upstream = await fetch(
      `${host.replace(/\/$/, "")}/${path.join("/")}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body.data),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!upstream.ok) return json("Search failed", 502)

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    })
  } catch {
    return json("Search unavailable", 503)
  }
}
