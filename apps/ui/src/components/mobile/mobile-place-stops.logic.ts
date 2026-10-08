import { nextVisits, type MobileTimetable } from "@repo/shared-data"

import type { MobileStopHit } from "@/lib/mobile-stop-search"

/** Nearest results arrive distance-sorted; keep one stop per service. */
export function nearestMobileLibraries(
  hits: readonly MobileStopHit[],
  max = 5
): MobileStopHit[] {
  const ids = new Set<string>(),
    result: MobileStopHit[] = []
  for (const hit of hits) {
    if (ids.has(hit.library_document_id)) continue
    ids.add(hit.library_document_id)
    result.push(hit)
    if (result.length === max) break
  }

  return result
}
export function nextStopVisit(hit: MobileStopHit, now: Date) {
  const tt: MobileTimetable = {
    version: 1,
    cycle: hit.cycle,
    stops: [
      {
        id: hit.stop_id,
        name: hit.name,
        where: hit.where,
        location: hit._geo ?? null,
        areaDocumentId: null,
      },
    ],
    visits: hit.visits,
  }

  // Cancellations are indexed per local date. Continue past an exceptional cancelled day.
  return (
    nextVisits(tt, [], hit.stop_id, now, hit.timezone ?? "UTC", 100).find(
      (visit) => !hit.cancelled_dates?.includes(visit.date)
    ) ?? null
  )
}
