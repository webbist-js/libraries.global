/** Bounded lookup of an existing profile; creating/changing usernames uses its stricter rule. */
export function isExistingProfileTarget(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 30 &&
    value.trim() === value &&
    !/[\\/?#\p{C}]/u.test(value)
  )
}
