/** Earned access is independent of the contributor's recognition tier. */
export const EARNED_PRO_POINTS = 5000
export const EARNED_PRO_ACTIVITY_DAYS = 30

/** Accepted work renews access; administrative adjustments and automatic bonuses do not. */
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

export function isQualifyingContribution(
  action: string,
  points: number
): boolean {
  return (
    points > 0 && (CONTRIBUTION_ACTIONS as readonly string[]).includes(action)
  )
}

export function contributionProExpiry(at: Date): string {
  return new Date(
    at.getTime() + EARNED_PRO_ACTIVITY_DAYS * 86_400_000
  ).toISOString()
}

export function hasEarnedPro(
  points: number | null | undefined,
  until: string | null | undefined,
  now: Date
): boolean {
  return (
    Number.isFinite(points) &&
    (points ?? 0) >= EARNED_PRO_POINTS &&
    typeof until === "string" &&
    Date.parse(until) > now.getTime()
  )
}
