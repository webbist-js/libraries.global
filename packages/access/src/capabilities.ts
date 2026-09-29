import type { ContributorRole } from "./roles"

export const SUBMISSION_TYPES = [
  "correction",
  "new_library",
  "library_claim",
  "library_edit",
  "wiki_edit",
  "blog_submission",
  "topic_suggestion",
] as const
export type SubmissionType = (typeof SUBMISSION_TYPES)[number]

export type Capability =
  | "submit.correction"
  | "submit.newLibrary"
  | "submit.claim"
  | "submit.libraryEdit"
  | "submit.docSuggestion"
  | "docs.directEdit"
  | "submit.journalPitch"
  | "journal.directEdit"
  | "submit.topicSuggestion"
  | "events.feed"

/**
 * Most library claims one session carries. The bridge and the submission
 * policy read at most this many affiliations, and the UI rejects more.
 */
export const SESSION_PROFILE_MAX_CLAIMS = 100

export interface CapabilityInput {
  signedIn: boolean
  contributorRole: ContributorRole | null
  claims: { libraryDocumentId: string }[]
  // Deliberately no plan, subscription or entitlement fields (spec §3.1).
}

export interface Capabilities {
  set: ReadonlySet<Capability>
  claimedLibraryIds: ReadonlySet<string>
}

/** Roles whose approved Knowledge edits publish without a second pass. */
const DOCS_EDITOR_ROLES: ReadonlySet<ContributorRole> = new Set([
  "wiki_editor",
  "editorial_board",
])

/** Roles whose approved Journal articles publish without a second pass. */
const JOURNAL_EDITOR_ROLES: ReadonlySet<ContributorRole> = new Set([
  "journal_editor",
  "editorial_board",
])

export function resolveCapabilities(input: CapabilityInput): Capabilities {
  const set = new Set<Capability>()
  const claimedLibraryIds = new Set(
    input.claims.map((c) => c.libraryDocumentId)
  )
  if (!input.signedIn) return { set, claimedLibraryIds }

  set.add("submit.correction")
  set.add("submit.newLibrary")
  set.add("submit.claim")
  set.add("submit.docSuggestion")
  set.add("submit.journalPitch")
  set.add("submit.topicSuggestion")
  if (claimedLibraryIds.size > 0) {
    set.add("submit.libraryEdit")
    set.add("events.feed")
  }
  if (input.contributorRole && DOCS_EDITOR_ROLES.has(input.contributorRole))
    set.add("docs.directEdit")
  if (input.contributorRole && JOURNAL_EDITOR_ROLES.has(input.contributorRole))
    set.add("journal.directEdit")

  return { set, claimedLibraryIds }
}

export function isSubmissionType(v: unknown): v is SubmissionType {
  return (
    typeof v === "string" && (SUBMISSION_TYPES as readonly string[]).includes(v)
  )
}

/**
 * Whether these capabilities allow a submission of `type`.
 *
 * `directWikiEdit` / `directJournalEdit` mark a submission whose approval
 * publishes the article straight away (a body edit to an existing article
 * by an editor). Suggestions and new-article drafts from any signed-in
 * contributor don't set them: their approval only writes a Strapi draft.
 */
export function canSubmit(
  c: Capabilities,
  type: SubmissionType,
  opts: {
    libraryDocumentId?: string
    directWikiEdit?: boolean
    directJournalEdit?: boolean
  } = {}
): boolean {
  switch (type) {
    case "correction":
      return c.set.has("submit.correction")
    case "new_library":
      return c.set.has("submit.newLibrary")
    case "library_claim":
      return c.set.has("submit.claim")
    case "library_edit":
      return (
        c.set.has("submit.libraryEdit") &&
        !!opts.libraryDocumentId &&
        c.claimedLibraryIds.has(opts.libraryDocumentId)
      )
    case "wiki_edit":
      return opts.directWikiEdit
        ? c.set.has("docs.directEdit")
        : c.set.has("submit.docSuggestion")
    case "blog_submission":
      return opts.directJournalEdit
        ? c.set.has("journal.directEdit")
        : c.set.has("submit.journalPitch")
    case "topic_suggestion":
      return c.set.has("submit.topicSuggestion")

    default:
      return false
  }
}
