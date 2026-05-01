import { headers } from "next/headers"

import { userHeaders } from "@/app/api/submissions/route"
import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
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

  let submissionId: unknown
  try {
    const body = await req.json()
    submissionId = body.submissionId
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (
    typeof submissionId !== "number" ||
    !Number.isInteger(submissionId) ||
    submissionId <= 0
  ) {
    return Response.json({ error: "Invalid submissionId" }, { status: 400 })
  }

  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/${submissionId}/finalize`,
    {
      method: "PATCH",
      headers: { ...userHeaders(session.user) },
    }
  )

  const data = await res.json()

  return Response.json(data, { status: res.status })
}
