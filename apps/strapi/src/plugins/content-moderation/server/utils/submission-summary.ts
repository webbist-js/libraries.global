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

export function summaryOf(sub: SummarySource): string {
  const f = sub.fields ?? {}
  const d = sub.draftData ?? {}
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null
  switch (sub.submissionType) {
    case "new_library":
      return str(f.name) ?? "Unnamed library"
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

      return `${role} application (${locales.length > 0 ? locales.join(", ") : "all languages"})`
    }
    case "location_request": {
      const edit =
        d.moderatorEdit && typeof d.moderatorEdit === "object"
          ? (d.moderatorEdit as Record<string, unknown>)
          : {}
      const name = str(edit.name) ?? str(f.name) ?? "unnamed"

      return `New ${f.kind === "area" ? "area" : "region"}: ${name}`
    }

    default:
      return sub.targetSlug ?? "Library"
  }
}
