import { headers } from "next/headers"

import { auth } from "@/lib/auth"

const STRAPI = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://127.0.0.1:1337"
const WIKI_EDITOR_ROLES = new Set(["wiki_editor", "editorial_board"])

async function getEditorSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const role = (session.user as Record<string, unknown>).contributorRole as
    | string
    | undefined
  if (!role || !WIKI_EDITOR_ROLES.has(role)) return null

  return session
}

// GET /api/contribute/wiki/[slug] — fetch existing draft for this slug
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const session = await getEditorSession()
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 })

  const jwt = (session.user as Record<string, unknown>).strapiJWT as string
  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/draft/wiki_edit?targetSlug=${encodeURIComponent(slug)}`,
    { headers: { Authorization: `Bearer ${jwt}` }, cache: "no-store" }
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
  const session = await getEditorSession()
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const jwt = (session.user as Record<string, unknown>).strapiJWT as string

  const res = await fetch(`${STRAPI}/api/content-moderation/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
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
  const session = await getEditorSession()
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const jwt = (session.user as Record<string, unknown>).strapiJWT as string

  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/${body.submissionId}/draft`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ draftData: body.draftData }),
    }
  )

  const data = await res.json()

  return Response.json(data, { status: res.status })
}
