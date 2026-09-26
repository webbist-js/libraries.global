import { headers } from "next/headers"

import { userHeaders } from "@/app/api/submissions/route"
import { requireCapability } from "@/lib/access-server"
import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

// GET /api/contribute/wiki/[slug] — fetch existing draft for this slug
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const denied = requireCapability(session?.user, "docs.directEdit")
  if (denied) return denied

  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/draft/wiki_edit?targetSlug=${encodeURIComponent(slug)}`,
    { headers: { ...userHeaders(session!.user) }, cache: "no-store" }
  )
  if (!res.ok) return Response.json({ draft: null })
  const data = await res.json()

  return Response.json(data)
}

// POST /api/contribute/wiki/[slug] — create new draft submission
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const denied = requireCapability(session?.user, "docs.directEdit")
  if (denied) return denied

  let body: { draftData?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const res = await fetch(`${STRAPI}/api/content-moderation/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...userHeaders(session!.user),
    },
    body: JSON.stringify({
      submissionType: "wiki_edit",
      targetEntityType: "wiki_article",
      targetSlug: slug,
      draftData: body.draftData,
    }),
  })

  const data = await res.json()

  return Response.json(data, { status: res.status })
}

// PATCH /api/contribute/wiki/[slug] — update draft data on existing submission
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: _slug } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const denied = requireCapability(session?.user, "docs.directEdit")
  if (denied) return denied

  let body: { submissionId?: unknown; draftData?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { submissionId } = body
  if (
    typeof submissionId !== "number" ||
    !Number.isInteger(submissionId) ||
    submissionId <= 0
  ) {
    return Response.json({ error: "Invalid submissionId" }, { status: 400 })
  }

  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/${submissionId}/draft`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...userHeaders(session!.user),
      },
      body: JSON.stringify({ draftData: body.draftData }),
    }
  )

  const data = await res.json()

  return Response.json(data, { status: res.status })
}
