/** Sitemaps are split at 40,000 URLs (the protocol allows 50,000). */
export const SITEMAP_CHUNK_SIZE = 40_000

/**
 * The sitemap ids: 0 holds every non-library page, then one chunk per
 * `SITEMAP_CHUNK_SIZE` library pages.
 */
export function chunkIds(libraryCount: number): { id: number }[] {
  const libraryChunks = Math.ceil(libraryCount / SITEMAP_CHUNK_SIZE)

  return Array.from({ length: 1 + libraryChunks }, (_, id) => ({ id }))
}

/** The library entries for chunk `id` (1-based; chunk 0 has none). */
export function sliceForChunk<T>(items: T[], id: number, size: number): T[] {
  if (id < 1) return []

  return items.slice((id - 1) * size, id * size)
}
