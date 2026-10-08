import { normalizeMobileTimetable } from "./normalize"
import type { MobileTimetable } from "./types"

export function timetableHash(tt: MobileTimetable | null): string {
  const normalized = normalizeMobileTimetable(tt)
  if (!normalized) return "empty"
  normalized.stops.sort((a, b) => a.id.localeCompare(b.id))
  normalized.visits.sort((a, b) => a.id.localeCompare(b.id))
  const bytes = new TextEncoder().encode(JSON.stringify(normalized))
  let hash = 0xcbf29ce484222325n
  for (const byte of bytes)
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n)

  return hash.toString(16).padStart(16, "0")
}

/** New records have no previous timetable; edits must match the live value. */
export function isStaleTimetableSuggestion(
  submissionType: string,
  fields: Record<string, unknown> | null | undefined,
  current: unknown
): boolean {
  if (
    submissionType === "new_library" ||
    !fields ||
    !Object.prototype.hasOwnProperty.call(fields, "mobileTimetable")
  )
    return false

  return (
    typeof fields.previousHash !== "string" ||
    fields.previousHash !== timetableHash(normalizeMobileTimetable(current))
  )
}
