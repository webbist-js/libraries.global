import type { Submission } from "@/hooks/useSubmissions"
import { editorApplyHref } from "@/lib/editor-gate"

/** Where an unsent draft continues: the record wizard or the article editor. */
export function continueHref(submission: Submission): string {
  const {
    submissionType,
    targetSlug,
    documentId,
    draftData,
    targetDocumentId,
  } = submission
  if (submissionType === "network_claim")
    return `/staff/networks?${new URLSearchParams({ ...(targetDocumentId ? { network: targetDocumentId } : {}), request: documentId })}`
  if (submissionType === "wiki_edit" || submissionType === "blog_submission") {
    const kind = submissionType === "wiki_edit" ? "knowledge" : "journal"
    if (
      (draftData as { kind?: unknown } | null)?.kind === "new_article" ||
      !targetSlug
    )
      return `/contribute/knowledge/new?type=${kind}&draft=${encodeURIComponent(documentId)}`

    const query = new URLSearchParams({ draft: documentId })
    const sourceLocale = draftData?.sourceLocale
    if (typeof sourceLocale === "string")
      query.set("sourceLocale", sourceLocale)
    const contentLocale = draftData?.locale
    if (typeof contentLocale === "string") query.set("locale", contentLocale)

    return `${kind === "knowledge" ? `/contribute/knowledge/${encodeURIComponent(targetSlug)}` : `/contribute/knowledge/journal/${encodeURIComponent(targetSlug)}`}?${query}`
  }
  if (
    (submissionType === "library_edit" || submissionType === "correction") &&
    targetSlug
  )
    return `/contribute/index/${encodeURIComponent(targetSlug)}`

  if (submissionType === "new_library")
    return draftData?.staffCreation
      ? "/staff/new"
      : "/contribute/index/new?draft=contribute"

  return "/contribute/index/new"
}

/**
 * Journal writers resume directly; Knowledge requires its editor grant.
 */
export function continueLink(
  submission: Submission,
  isEditor: (kind: "knowledge" | "journal") => boolean
): { href: string; label: string } {
  const href = continueHref(submission)
  const { submissionType } = submission
  if (submissionType !== "wiki_edit" && submissionType !== "blog_submission")
    return { href, label: "Continue" }
  const kind = submissionType === "wiki_edit" ? "knowledge" : "journal"

  return kind === "journal" || isEditor(kind)
    ? { href, label: "Continue" }
    : { href: editorApplyHref(kind), label: "Apply to edit" }
}
