"use client"

import { PaginationControls } from "@/components/ds/PaginationControls"

/** Compatibility adapter: one-based pages; hides for zero or one result page. */
export function IndexPager({
  page,
  totalPages,
  onPageChange,
}: {
  readonly page: number
  readonly totalPages: number
  readonly onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <PaginationControls
      page={page - 1}
      pageCount={totalPages}
      onPage={(next) => onPageChange(next + 1)}
      appearance="index"
    />
  )
}
