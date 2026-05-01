import { headers } from "next/headers"

import { auth } from "@/lib/auth"

const STRAPI = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://127.0.0.1:1337"
const WIKI_EDITOR_ROLES = new Set(["wiki_editor", "editorial_board"])

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as Record<string, unknown>).contributorRole as
    | string
    | undefined
  if (!role || !WIKI_EDITOR_ROLES.has(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { submissionId } = await req.json()
  const jwt = (session.user as Record<string, unknown>).strapiJWT as string

  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/${submissionId}/finalize`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${jwt}` },
    }
  )

  const data = await res.json()

  return Response.json(data, { status: res.status })
}
