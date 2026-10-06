/**
 * "Not checked in over two years": the Noticeboard's stale-records cutoff.
 * Pure, so the server's gap counts and the client links that propose a
 * verify drive for those records share one date.
 */

/**
 * Two years before `now`, in Unix seconds: the unit of the index's
 * `last_verified_ts` (apps/strapi/src/utils/library-search-fields.ts).
 */
export function staleCutoff(now: Date): number {
  const d = new Date(now)
  d.setUTCFullYear(d.getUTCFullYear() - 2)

  return Math.floor(d.getTime() / 1000)
}

/** The cutoff's day as `YYYY-MM-DD` (UTC): a verify drive's "before". */
export function staleCutoffDay(now: Date): string {
  return new Date(staleCutoff(now) * 1000).toISOString().slice(0, 10)
}
