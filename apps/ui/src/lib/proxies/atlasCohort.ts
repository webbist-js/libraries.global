import { NextRequest, type NextResponse } from "next/server"

import {
  ATLAS_COHORT_COOKIE,
  atlasCohortFromHeaders,
  atlasRolloutPercent,
} from "@/lib/atlas-rollout"

export function atlasCohortRequest(req: NextRequest): {
  request: NextRequest
  created?: string
} {
  const percent = atlasRolloutPercent()
  if (
    process.env.ATLAS_QUERY_ENABLED !== "true" ||
    process.env.ATLAS_PROVIDER !== "scalable" ||
    percent === 0 ||
    percent === 100 ||
    req.nextUrl.pathname.startsWith("/api/") ||
    /^\/embed\/w\/[A-Za-z0-9_-]{24}\/?$/.test(req.nextUrl.pathname) ||
    req.nextUrl.pathname === "/embed/resize.js"
  )
    return { request: req }
  const cohort = atlasCohortFromHeaders(req.headers)
  if (cohort && /^[a-f0-9]{32}$/.test(cohort)) return { request: req }
  const created = crypto.randomUUID().replaceAll("-", "")
  const headers = new Headers(req.headers)
  headers.set(
    "cookie",
    [
      ...(headers.get("cookie") ?? "")
        .split(";")
        .filter(
          (value) =>
            value.trim() && !value.trim().startsWith(`${ATLAS_COHORT_COOKIE}=`)
        ),
      `${ATLAS_COHORT_COOKIE}=${created}`,
    ].join("; ")
  )

  return { request: new NextRequest(req, { headers }), created }
}
export function atlasCohortResponse(
  response: NextResponse,
  created?: string
): NextResponse {
  if (created)
    response.cookies.set(ATLAS_COHORT_COOKIE, created, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 86400,
    })

  return response
}
