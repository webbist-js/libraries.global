/**
 * Module-scope memo for the Atlas FeatureCollection (E3).
 *
 * Building the collection walks every published library, so it is kept for
 * five minutes per locale and cleared whenever a library row is written
 * (create, update, publish, unpublish, delete: see `lifeCycles/entityRef.ts`).
 * The in-flight promise is what's stored, so concurrent first requests share
 * one build; a rejected build is dropped so the next request retries.
 */

const TTL_MS = 5 * 60 * 1000

/** What the atlas endpoint tells CDNs and browsers. */
export const ATLAS_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=3600"

const entries = new Map<string, { at: number; value: Promise<unknown> }>()

export function getAtlasCache<T>(key: string): Promise<T> | null {
  const hit = entries.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) {
    entries.delete(key)

    return null
  }

  return hit.value as Promise<T>
}

export function setAtlasCache<T>(key: string, value: Promise<T>): Promise<T> {
  entries.set(key, { at: Date.now(), value })
  value.catch(() => {
    if (entries.get(key)?.value === value) entries.delete(key)
  })

  return value
}

export function invalidateAtlasCache(): void {
  entries.clear()
}
