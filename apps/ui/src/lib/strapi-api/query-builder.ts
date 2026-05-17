/** Produces `{ $eq: value }` for a non-empty string, or `{ $null: true }` otherwise. */
export function eqOrNull(value: string | null | undefined) {
  return value && value.length > 0 ? { $eq: value } : { $null: true }
}

/** Produces `{ $eq: value }`. */
export function eqFilter(value: string) {
  return { $eq: value }
}
