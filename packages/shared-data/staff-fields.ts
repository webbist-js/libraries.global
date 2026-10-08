export const MODERATED_LIBRARY_FIELDS: readonly string[] = [
  "continent",
  "country",
  "region",
  "area",
  "location",
  "streetAddress",
  "city",
  "postalCode",
  "district",
  "libraryType",
  "slug",
  "entityRef",
]

export function isModeratedLibraryChange(
  field: string,
  next: unknown
): boolean {
  const canonical = field.endsWith("DocumentId")
    ? field.slice(0, -10)
    : field === "lat" || field === "lng"
      ? "location"
      : field

  return (
    MODERATED_LIBRARY_FIELDS.includes(canonical) ||
    canonical === "homeLibrary" ||
    (field === "operationalStatus" && next === "permanently_closed")
  )
}
