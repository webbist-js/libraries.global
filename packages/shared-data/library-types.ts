export const DEFAULT_LIBRARY_TYPES = [
  "National",
  "Regional",
  "Public",
  "Academic",
  "University",
  "Parliamentary",
  "State",
  "Municipal",
  "Special",
  "Specific User Groups",
  "Monastic",
  "Archive",
  "Private",
  "Cultural",
  "Digital",
  "Mobile",
  "Other",
] as const

export type LibraryTypeValue = string | { name?: string | null } | null

/** Display name from a populated CMS relation or a flattened search/DTO value. */
export function libraryTypeName(value: unknown): string | null {
  if (typeof value === "string") return value || null
  if (value && typeof value === "object" && "name" in value)
    return typeof value.name === "string" ? value.name : null

  return null
}
