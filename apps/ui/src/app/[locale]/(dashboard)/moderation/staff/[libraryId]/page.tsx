import { Icon } from "@iconify/react"
import { notFound } from "next/navigation"

import { Notice } from "@/components/ds"
import { StaffAccessList, type StaffAccessRow } from "@/components/moderation"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { T } from "@/lib/design-tokens"
import { fetchModeration } from "@/lib/moderation-proxy"
import { Link } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"
import { fetchPlaceLink } from "@/lib/strapi-api/content/server"

import { ModerationAccessUnavailable } from "../../_components/ModerationAccessUnavailable"
import { ModerationHero } from "../../_components/ModerationHero"
import { requireModerator } from "../../_components/moderator"

export const metadata = privateMetadata("Staff access")

/** The list arrives bare or wrapped; either way it's rows plus, maybe, a name. */
function parseRows(body: unknown): {
  rows: StaffAccessRow[]
  libraryName: string | null
} {
  const raw = Array.isArray(body)
    ? body
    : body && typeof body === "object"
      ? ((body as { data?: unknown }).data ?? [])
      : []
  const named =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { library?: { name?: string | null } }).library?.name
      : null
  const rows = (Array.isArray(raw) ? raw : []).flatMap(
    (r): StaffAccessRow[] => {
      if (!r || typeof r !== "object") return []
      const row = r as Record<string, unknown>
      if (typeof row.affiliationDocumentId !== "string") return []

      return [
        {
          affiliationDocumentId: row.affiliationDocumentId,
          name:
            typeof row.name === "string" && row.name ? row.name : "A member",
          staffRole: row.staffRole === "owner" ? "owner" : "editor",
          source:
            row.source === "team" || row.source === "claim" ? row.source : null,
          approvedAt:
            typeof row.approvedAt === "string" ? row.approvedAt : null,
          canRemove: row.canRemove === true,
        },
      ]
    }
  )

  return { rows, libraryName: typeof named === "string" ? named : null }
}

function staffAccessError(status: number) {
  if (status === 403)
    return {
      title: "Outside your moderation scope",
      message: "Only Moderators of the index queue can see a library’s staff.",
    }
  if (status === 429)
    return {
      title: "Too many requests in a short time",
      message: "Wait a few seconds, then reload this page.",
    }

  return {
    title: "The staff list couldn’t be loaded",
    message:
      "Try again in a moment. If it keeps failing, the staff list route may not be live yet.",
  }
}

/**
 * Everyone with staff access to one library, for Moderators of the index
 * queue: reached from a claim's review panel and from the staff-access
 * report email. Removal uses the same route as the claim panel; Strapi
 * re-checks the scope on every request.
 */
export default async function StaffAccessPage({
  params,
}: {
  readonly params: Promise<{ libraryId: string }>
}) {
  const { libraryId } = await params
  if (!isDocumentIdParam(libraryId)) notFound()
  const { user, scopes, accessUnknown } = await requireModerator(
    `/moderation/staff/${libraryId}`
  )
  if (accessUnknown)
    return (
      <ModerationAccessUnavailable
        title="Staff *access*"
        leaf="Staff access"
        path={`/moderation/staff/${libraryId}`}
      />
    )
  if (!scopes.some((s) => s.queue === "all" || s.queue === "index")) notFound()
  const [res, place] = await Promise.all([
    fetchModeration<unknown>(user, `staff/${encodeURIComponent(libraryId)}`),
    fetchPlaceLink(libraryId),
  ])
  if (res.status === 404) notFound()
  const { rows, libraryName } = parseRows(res.body)
  const name = libraryName ?? place?.name ?? "this library"
  const error = staffAccessError(res.status)

  return (
    <>
      <ModerationHero
        title={`Staff access · *${name}*`}
        plainTitle={false}
        leaf="Staff access"
        lead="Who can publish to this record, how they got access and since when. Remove anyone whose access shouldn’t stand; they’re emailed and the change is audited."
      >
        {place?.href ? (
          <p className="m-0 text-base">
            <Link
              href={place.href}
              className="inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              View the public page
              <Icon
                aria-hidden="true"
                icon="mdi:arrow-top-right"
                width={15}
                height={15}
              />
            </Link>
          </p>
        ) : null}
      </ModerationHero>
      <div className="mx-auto w-full max-w-[960px] px-4 pt-8 pb-16 sm:px-8">
        {res.status === 200 ? (
          <StaffAccessList libraryName={name} rows={rows} />
        ) : (
          <Notice
            icon="mdi:alert-circle-outline"
            tone="warn"
            title={error.title}
          >
            <p className="m-0" style={{ color: T.ink.base }}>
              {error.message}
            </p>
          </Notice>
        )}
      </div>
    </>
  )
}
