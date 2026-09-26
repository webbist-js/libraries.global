import { headers } from "next/headers"

import { userHeaders } from "@/app/api/submissions/route"
import { requireCapability } from "@/lib/access-server"
import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  const denied = requireCapability(session?.user, "docs.directEdit")
  if (denied) return denied

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
      headers: { ...userHeaders(session!.user) },
    }
  )

  const data = await res.json()

  return Response.json(data, { status: res.status })
}
