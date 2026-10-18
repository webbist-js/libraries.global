import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { userHeaders } from "@/lib/bridge-user-headers"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

// GET /api/submissions/my — list the caller's own submissions
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  let res: Response
  const documentId = new URL(req.url).searchParams.get("documentId")
  if (documentId !== null && !isDocumentIdParam(documentId))
    return NextResponse.json(
      { error: "Invalid submission id" },
      { status: 400 }
    )
  const query = documentId
    ? `?documentId=${encodeURIComponent(documentId)}`
    : ""
  try {
    res = await fetch(
      `${STRAPI}/api/content-moderation/submissions/my${query}`,
      {
        headers: userHeaders(session.user),
        cache: "no-store",
      }
    )
  } catch {
    return NextResponse.json(
      { error: "Submission service unavailable" },
      { status: 503 }
    )
  }

  const json = await res.json()

  return NextResponse.json(json, {
    status: res.status,
    headers: { "Cache-Control": "private, no-store" },
  })
}
