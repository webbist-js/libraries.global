import type { Capability } from "@repo/access"

import { requireCapability } from "@/lib/access-server"
import { auth } from "@/lib/auth"
import { isDocumentIdParam, readJsonCapped } from "@/lib/bridge-params"
import { userHeaders } from "@/lib/bridge-user-headers"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

/**
 * The editor-only draft routes for an existing article
 * (`/api/contribute/wiki/[slug]` and `/api/contribute/journal/[slug]`):
 * read, create, update and finalize a direct-edit draft, gated on the
 * editor capability as a fast pre-check. Strapi's submission policy is the
 * real gate. Draft ids are Strapi documentIds, which is what the
 * content-moderation routes validate.
 */
export function articleDraftHandlers(spec: {
  submissionType: "wiki_edit" | "blog_submission"
  targetEntityType: "wiki_article" | "blog_article"
  capability: Capability
}) {
  type Params = { params: Promise<{ slug: string }> }

  async function gate() {
    const session = await auth.api.getSession({
      headers: await import("next/headers").then((m) => m.headers()),
    })
    const denied = requireCapability(session?.user, spec.capability)

    return { session, denied }
  }

  async function GET(_req: Request, { params }: Params) {
    const { slug } = await params
    const { session, denied } = await gate()
    if (denied) return denied

    const res = await fetch(
      `${STRAPI}/api/content-moderation/submissions/draft/${spec.submissionType}?targetSlug=${encodeURIComponent(slug)}`,
      { headers: { ...userHeaders(session!.user) }, cache: "no-store" }
    )
    if (!res.ok) return Response.json({ data: null })

    return Response.json(await res.json())
  }

  async function POST(req: Request, { params }: Params) {
    const { slug } = await params
    const { session, denied } = await gate()
    if (denied) return denied

    const parsed = await readJsonCapped(req, 512 * 1024)
    if (!parsed.ok)
      return Response.json(
        { error: "Invalid request body" },
        { status: parsed.status }
      )
    const body = parsed.body as { draftData?: unknown; editSummary?: unknown }

    const res = await fetch(`${STRAPI}/api/content-moderation/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...userHeaders(session!.user),
      },
      body: JSON.stringify({
        submissionType: spec.submissionType,
        targetEntityType: spec.targetEntityType,
        targetSlug: slug,
        draftData: body.draftData,
        ...(typeof body.editSummary === "string"
          ? { editSummary: body.editSummary }
          : {}),
        asDraft: true,
      }),
    })

    return Response.json(await res.json(), { status: res.status })
  }

  async function PATCH(req: Request, _ctx: Params) {
    const { session, denied } = await gate()
    if (denied) return denied

    const parsed = await readJsonCapped(req, 512 * 1024)
    if (!parsed.ok)
      return Response.json(
        { error: "Invalid request body" },
        { status: parsed.status }
      )
    const body = parsed.body as { submissionId?: unknown; draftData?: unknown }
    if (
      typeof body.submissionId !== "string" ||
      !isDocumentIdParam(body.submissionId)
    )
      return Response.json({ error: "Invalid submissionId" }, { status: 400 })

    const res = await fetch(
      `${STRAPI}/api/content-moderation/submissions/${encodeURIComponent(body.submissionId)}/draft`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...userHeaders(session!.user),
        },
        body: JSON.stringify({ draftData: body.draftData }),
      }
    )

    return Response.json(await res.json(), { status: res.status })
  }

  async function FINALIZE(req: Request) {
    const { session, denied } = await gate()
    if (denied) return denied

    const parsed = await readJsonCapped(req, 512 * 1024)
    if (!parsed.ok)
      return Response.json(
        { error: "Invalid request body" },
        { status: parsed.status }
      )
    const body = parsed.body as { submissionId?: unknown } & Record<
      string,
      unknown
    >
    const { submissionId, ...formData } = body
    if (typeof submissionId !== "string" || !isDocumentIdParam(submissionId))
      return Response.json({ error: "Invalid submissionId" }, { status: 400 })

    const res = await fetch(
      `${STRAPI}/api/content-moderation/submissions/${encodeURIComponent(submissionId)}/finalize`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...userHeaders(session!.user),
        },
        body: JSON.stringify(formData),
      }
    )

    return Response.json(await res.json(), { status: res.status })
  }

  return { GET, POST, PATCH, FINALIZE }
}
