import { healthNote } from "@/lib/staff/format"
import { staffLibraryHref } from "@/lib/staff/paths"
import type { StaffOverview } from "@/lib/staff/types"

/** Older bridges may emit ID-based links; presentation always uses canonical slugs. */
export function staffHealthRows(overview: StaffOverview) {
  const base = staffLibraryHref(overview.library.slug)

  return overview.health.map((row) => ({
    ...row,
    note: healthNote(row.note),
    ...(row.action
      ? {
          action: {
            ...row.action,
            href: row.action.href.replace(
              /^\/(?:contribute\/)?staff\/[^/?#]+/,
              base
            ),
          },
        }
      : {}),
  }))
}
