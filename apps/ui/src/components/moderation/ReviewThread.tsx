import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

import { formatDateTime, type ReviewEvent, statusMeta } from "./submissionMeta"

function who(e: ReviewEvent): string {
  if (e.byViewer) return "You"
  if (e.toStatus === "pending") return "The contributor"
  if (e.reviewerKind === "system") return "Libraries Global"
  if (e.reviewerKind === "admin") return "An admin"

  return "A moderator"
}

function verb(e: ReviewEvent): string {
  switch (e.toStatus) {
    case "pending":
      return e.fromStatus === "needs_info" ? "resubmitted it" : "submitted it"
    case "approved":
      return "approved it"
    case "rejected":
      return "rejected it"
    case "needs_info":
      return "asked for changes"

    default:
      return `moved it to ${statusMeta(e.toStatus ?? "unknown").label.toLowerCase()}`
  }
}

/**
 * The submission's Review Events, oldest first: who moved it, to what, and
 * the note they left. Reviewers are named only as "You", "A moderator" or
 * "An admin"; Strapi never sends their ids.
 */
export function ReviewThread({ events }: { readonly events: ReviewEvent[] }) {
  if (events.length === 0)
    return (
      <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
        No decisions yet.
      </p>
    )

  return (
    <ol className="m-0 flex list-none flex-col gap-4 p-0">
      {events.map((e) => {
        const meta = statusMeta(e.toStatus ?? "")

        return (
          <li key={e.documentId} className="flex gap-3">
            <Icon
              aria-hidden="true"
              icon={meta.icon}
              width={18}
              height={18}
              className="mt-0.5 shrink-0"
              style={{ color: T.ink.dim }}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="m-0 text-[14px]" style={{ color: T.ink.base }}>
                <strong className="font-semibold">{who(e)}</strong> {verb(e)}
              </p>
              <p className="m-0 text-[13px]" style={{ color: T.ink.low }}>
                <time dateTime={e.createdAt}>
                  {formatDateTime(e.createdAt)}
                </time>
              </p>
              {e.note ? (
                <blockquote
                  className="m-0 mt-1 rounded-[14px] px-3 py-2 text-[14px] leading-normal whitespace-pre-wrap"
                  style={{
                    background: T.bg.surface,
                    border: `1px solid ${T.border.line}`,
                    color: T.ink.base,
                  }}
                >
                  {e.note}
                </blockquote>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
