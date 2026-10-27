import { EVENT_PROVIDERS } from "@repo/shared-data"

/**
 * One line describing what a submission is about, for the moderation
 * queue. A port of `summaryOf` in `admin/src/components/submissionMeta.ts`
 * (the admin keeps its own copy); keep the two in step.
 */
export type SummarySource = {
  submissionType: string
  targetSlug?: string | null
  fields?: Record<string, unknown> | null
  draftData?: Record<string, unknown> | null
}

/**
 * A Drive Proposal's title without its `*italic*` markers, or null when it
 * has none.
 */
export function driveProposalTitle(draftData: unknown): string | null {
  const drive =
    draftData && typeof draftData === "object"
      ? (draftData as Record<string, unknown>).drive
      : null
  const title =
    drive && typeof drive === "object"
      ? (drive as Record<string, unknown>).title
      : null
  if (typeof title !== "string") return null
  const plain = title.replaceAll("*", "").trim()

  return plain || null
}

export function summaryOf(sub: SummarySource): string {
  const f = sub.fields ?? {}
  const d = sub.draftData ?? {}
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null
  switch (sub.submissionType) {
    case "new_library":
      return str(f.name) ?? "Unnamed library"
    case "network_claim":
      return `${String(f.networkName ?? "Service")} · ${String(f.intent ?? "affiliation")} · ${Array.isArray(f.libraryIds) ? f.libraryIds.length : 0} libraries`
    case "library_claim":
      return str(f.name) ?? sub.targetSlug ?? "Library claim"
    case "wiki_edit":
    case "blog_submission":
      return (
        str(d.title) ??
        str(d.proposedTitle) ??
        str(f.title) ??
        (sub.targetSlug ? `Edit: ${sub.targetSlug}` : "Untitled article")
      )
    case "topic_suggestion":
      return str(f.name) ?? "Topic"
    case "event_feed": {
      const library = str(f.libraryName) ?? sub.targetSlug ?? "a library"

      return `${EVENT_PROVIDERS[f.provider as keyof typeof EVENT_PROVIDERS]?.label ?? "Event"} feed for ${library}${f.kind === "replace" ? " (new details)" : ""}`
    }
    case "role_application": {
      const role =
        f.role === "journal_editor"
          ? "Journal editor"
          : f.role === "wiki_editor"
            ? "Knowledge editor"
            : "Editor"
      const locales = Array.isArray(f.locales)
        ? [
            ...new Set(
              f.locales.flatMap((l: unknown) => {
                const code = str(l)

                return code ? [code] : []
              })
            ),
          ]
        : []

      const languages =
        locales.length > 0 ? locales.join(", ") : "all languages"
      if (f.role === "moderator") {
        const queue =
          f.queue === "index"
            ? "Index"
            : f.queue === "knowledge"
              ? "Knowledge"
              : f.queue === "journal"
                ? "Journal"
                : "Queue"

        return `Moderator application: ${queue} (${languages})`
      }

      return `${role} application (${languages})`
    }
    case "drive_proposal": {
      const title = driveProposalTitle(d)

      return title ? `Drive: ${title}` : "Drive proposal"
    }

    default:
      return sub.targetSlug ?? "Library"
  }
}
