import { NextResponse } from "next/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export type PublicSubmission = {
  documentId: string
  submissionType:
    | "correction"
    | "new_library"
    | "library_claim"
    | "library_edit"
    | "wiki_edit"
    | "blog_submission"
    | "topic_suggestion"
  status: "pending" | "approved" | "rejected" | "needs_info"
  targetEntityType: string | null
  targetSlug: string | null
  targetLabel: string | null
  editSummary: string | null
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  if (!SECRET) return NextResponse.json({ data: [] })

  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/by-username/${encodeURIComponent(username)}`,
    {
      headers: { "X-Service-Secret": SECRET },
      next: { revalidate: 60 },
    }
  )
  if (!res.ok) return NextResponse.json({ data: [] })

  const json = (await res.json()) as { data?: PublicSubmission[] }

  return NextResponse.json({ data: json.data ?? [] })
}
