/**
 * The `where` fragment for a child count on a location page: published rows
 * only (unless previewing drafts) and, when the request names a locale, that
 * locale's rows only — so a page never counts every translation of a record.
 */
export const scopedWhere = (
  status: "draft" | "published",
  locale: string | undefined
): Record<string, unknown> => ({
  ...(status === "published" ? { publishedAt: { $notNull: true } } : {}),
  ...(locale ? { locale } : {}),
})
