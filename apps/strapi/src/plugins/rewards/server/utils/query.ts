// Same contract as the events plugin's clampInt; duplicated on purpose so
// the plugins don't import each other.

/** Parses a query value as an integer within [min, max]; non-numeric → def. */
export function clampInt(
  value: unknown,
  { def, min, max }: { def: number; min: number; max: number }
): number {
  if (typeof value !== "string" && typeof value !== "number") return def
  if (typeof value === "string" && value.trim() === "") return def
  const n = Math.trunc(Number(value))
  if (Number.isNaN(n)) return def

  return Math.min(max, Math.max(min, n))
}
