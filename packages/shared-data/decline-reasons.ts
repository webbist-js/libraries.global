export const DECLINE_REASONS = [
  "not_accurate",
  "already_up_to_date",
  "not_about_this_library",
  "other",
] as const
export type DeclineReason = (typeof DECLINE_REASONS)[number]
export const DECLINE_REASON_LABELS: Record<DeclineReason, string> = {
  not_accurate: "Not accurate",
  already_up_to_date: "Already up to date",
  not_about_this_library: "Not about this library",
  other: "Other",
}
