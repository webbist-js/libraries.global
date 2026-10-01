/**
 * The library attributes that vary by locale: the `string`, `text` and
 * `blocks` attributes of `api::library.library` marked
 * `pluginOptions.i18n.localized: true` (the `seo` component aside). A change
 * written to a non-default locale may touch only these; everything else is
 * shared by every locale version and belongs to the default one.
 *
 * `apps/strapi/tests/localized-library-fields.test.ts` keeps this list in
 * step with the schema.
 */
export const LOCALIZED_LIBRARY_FIELDS: readonly string[] = [
  "name",
  "shortName",
  "summary",
  "description",
  "city",
  "district",
  "streetAddress",
  "closureReason",
  "visitNotes",
  "admissionInfo",
  "accessibilityNotes",
  "buildingInfo",
  "transitInfo",
]
