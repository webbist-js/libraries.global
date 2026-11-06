/**
 * Earned recognition. Contributor and Supporter are counted from accepted,
 * substantive contributions (one per accepted submission or suggestion), never
 * from a raw points total. Recognition adds tools and limits only: it never
 * grants editing authority, staff verification or machine API quota.
 */

/** Accepted contributions that make an account a Contributor. */
export const CONTRIBUTOR_MIN_ACCEPTED = 1
/** Accepted contributions for durable Supporter recognition. */
export const SUPPORTER_MIN_ACCEPTED = 100
/** A recent accepted contribution shows the separate "active" status. */
export const CONTRIBUTION_ACTIVITY_DAYS = 30

/**
 * Point actions that count as one accepted, substantive contribution.
 * Administrative adjustments, daily streaks and automatic bonuses do not.
 */
export const CONTRIBUTION_ACTIONS = [
  "new_library_approved",
  "edit_accepted_minor",
  "edit_accepted_major",
  "correction_approved",
  "claim_approved",
  "photo_licensed_cc",
  "hours_verified",
  "status_verified",
  "wiki_translated",
  "journal_accepted",
  "journal_edit_accepted",
  "journal_translated",
  "knowledge_article_published",
  "knowledge_edit_accepted",
  "source_added",
  "drive_task_accepted",
  "drive_proposal_accepted",
  "discussion_thread_accepted",
  "discussion_reply_accepted",
  "discussion_edit_accepted",
  "event_feed_accepted",
  "option_suggestion_accepted",
] as const
export type ContributionAction = (typeof CONTRIBUTION_ACTIONS)[number]

export function isQualifyingContribution(
  action: string,
  points: number
): boolean {
  return (
    points > 0 && (CONTRIBUTION_ACTIONS as readonly string[]).includes(action)
  )
}

export type RecognitionInput = {
  /** Distinct accepted contributions (by source identifier). */
  acceptedContributions?: number | null
  /** A moderator revoked recognition for fraud or duplication. */
  recognitionRevoked?: boolean | null
}

export type Recognition = "none" | "contributor" | "supporter"

const count = (n: number | null | undefined) =>
  Number.isSafeInteger(n) && (n as number) > 0 ? (n as number) : 0

export function recognitionOf(input: RecognitionInput): Recognition {
  if (input.recognitionRevoked) return "none"
  const accepted = count(input.acceptedContributions)
  if (accepted >= SUPPORTER_MIN_ACCEPTED) return "supporter"
  if (accepted >= CONTRIBUTOR_MIN_ACCEPTED) return "contributor"

  return "none"
}

/** Separate from recognition: whether the account contributed recently. */
export function isRecentlyActive(
  lastContributionAt: string | null | undefined,
  now: Date
): boolean {
  if (typeof lastContributionAt !== "string") return false
  const at = Date.parse(lastContributionAt)

  return (
    Number.isFinite(at) &&
    now.getTime() - at <= CONTRIBUTION_ACTIVITY_DAYS * 86_400_000
  )
}
