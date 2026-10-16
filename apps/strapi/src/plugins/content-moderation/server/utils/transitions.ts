export type ModerationStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "needs_info"

const ALLOWED: Record<ModerationStatus, readonly ModerationStatus[]> = {
  draft: ["pending"],
  pending: ["approved", "rejected", "needs_info"],
  needs_info: ["draft", "pending", "approved", "rejected"],
  approved: [],
  rejected: [],
}

export function canTransition(
  from: ModerationStatus,
  to: ModerationStatus,
  opts: { staffPublish?: boolean; contributorWithdraw?: boolean } = {}
): boolean {
  if (from === "pending" && to === "draft")
    return opts.contributorWithdraw === true
  if (from === "draft" && to === "approved") return opts.staffPublish === true

  return ALLOWED[from]?.includes(to) ?? false
}

/** Statuses a moderator may act on. */
export const REVIEWABLE: readonly ModerationStatus[] = ["pending", "needs_info"]
