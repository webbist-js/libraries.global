/**
 * Staff pages are addressed by the library's slug (`/staff/{slug}/…`); the
 * staff APIs stay on the document id (`/api/staff/{documentId}/…`).
 */

/** A slug a staff page accepts: Strapi uid characters, at most 255 long. */
export const STAFF_SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i
export const MAX_STAFF_SLUG_LENGTH = 255

export const isStaffSlugParam = (value: string): boolean =>
  value.length <= MAX_STAFF_SLUG_LENGTH && STAFF_SLUG_PATTERN.test(value)

/** A library's staff page, or the staff index when no slug is known. */
export function staffLibraryHref(
  slug: string | null | undefined,
  suffix = ""
): string {
  return slug ? `/staff/${encodeURIComponent(slug)}${suffix}` : "/staff"
}
