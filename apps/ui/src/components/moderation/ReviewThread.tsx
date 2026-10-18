import { Check, Clock3, MessageCircle, X } from "lucide-react"

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
    <ol className="relative m-0 flex list-none flex-col gap-4 p-0 before:absolute before:top-3 before:bottom-3 before:left-[14px] before:w-px before:bg-(--t-border-line)">
      {events.map((e) => {
        const HistoryIcon =
          e.toStatus === "approved"
            ? Check
            : e.toStatus === "rejected"
              ? X
              : e.toStatus === "needs_info"
                ? MessageCircle
                : Clock3

        return (
          <li key={e.documentId} className="relative flex gap-3">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full"
              style={{
                background:
                  e.toStatus === "approved"
                    ? "var(--t-palette-mint-soft)"
                    : e.toStatus === "rejected"
                      ? "var(--t-palette-coral-soft)"
                      : T.bg.muted,
              }}
            >
              <HistoryIcon
                aria-hidden="true"
                size={14}
                style={{
                  color:
                    e.toStatus === "approved"
                      ? T.accent.ok
                      : e.toStatus === "rejected"
                        ? T.accent.danger
                        : T.ink.dim,
                }}
              />
            </span>
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
