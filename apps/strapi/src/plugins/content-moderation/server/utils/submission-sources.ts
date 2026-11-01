import {
  appendSourceRecords,
  publicSourceUrl,
  submittedSourceRecords,
} from "@repo/shared-data"

/** Personal evidence (emails, calls, private documents) must never become a public citation. */
export function publicEvidenceUrl(
  type: string | null | undefined,
  url: string | null | undefined
): string | null {
  return type === "institutional_url" || type === "press_release"
    ? publicSourceUrl(url)
    : null
}

/** Public citations supplied with a new library, including the separate evidence field. */
export function newLibrarySources(submission: {
  fields?: Record<string, unknown> | null
  evidenceType?: string | null
  evidenceUrl?: string | null
}) {
  const url = publicEvidenceUrl(submission.evidenceType, submission.evidenceUrl)

  return appendSourceRecords(
    submittedSourceRecords(submission.fields?.sourceRecords),
    url ? [{ role: "reference", url }] : []
  )
}
