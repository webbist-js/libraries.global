/** One-based visible pages, bounded work even for very large result sets. */
export function paginationPages(page: number, total: number): number[] {
  return [...new Set([1, page - 1, page, page + 1, total])]
    .filter((value) => value >= 1 && value <= total)
    .sort((a, b) => a - b)
}
