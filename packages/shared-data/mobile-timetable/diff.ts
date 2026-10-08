import type { MobileStop, MobileTimetable, MobileVisit } from "./types"

export type TimetableDiff = {
  stopsAdded: MobileStop[]
  stopsRemoved: MobileStop[]
  stopsChanged: {
    before: MobileStop
    after: MobileStop
    fields: ("name" | "where" | "location")[]
  }[]
  visitsAdded: MobileVisit[]
  visitsRemoved: MobileVisit[]
  visitsChanged: { before: MobileVisit; after: MobileVisit }[]
  cycleChanged: boolean
}
export function diffTimetable(
  a: MobileTimetable | null,
  b: MobileTimetable | null
): TimetableDiff {
  const beforeStops = new Map(a?.stops.map((s) => [s.id, s])),
    afterStops = new Map(b?.stops.map((s) => [s.id, s])),
    beforeVisits = new Map(a?.visits.map((v) => [v.id, v])),
    afterVisits = new Map(b?.visits.map((v) => [v.id, v]))

  return {
    stopsAdded: [...afterStops.values()].filter((s) => !beforeStops.has(s.id)),
    stopsRemoved: [...beforeStops.values()].filter(
      (s) => !afterStops.has(s.id)
    ),
    stopsChanged: [...afterStops.values()].flatMap((after) => {
      const before = beforeStops.get(after.id)
      if (!before) return []
      const fields = (["name", "where", "location"] as const).filter(
        (f) => JSON.stringify(before[f]) !== JSON.stringify(after[f])
      )

      return fields.length ? [{ before, after, fields }] : []
    }),
    visitsAdded: [...afterVisits.values()].filter(
      (v) => !beforeVisits.has(v.id)
    ),
    visitsRemoved: [...beforeVisits.values()].filter(
      (v) => !afterVisits.has(v.id)
    ),
    visitsChanged: [...afterVisits.values()].flatMap((after) => {
      const before = beforeVisits.get(after.id)

      return before && JSON.stringify(before) !== JSON.stringify(after)
        ? [{ before, after }]
        : []
    }),
    cycleChanged:
      JSON.stringify(a?.cycle ?? null) !== JSON.stringify(b?.cycle ?? null),
  }
}
export function summarizeDiff(d: TimetableDiff): string {
  const parts: string[] = []
  for (const [n, label] of [
    [d.stopsAdded.length, "stop added"],
    [d.stopsRemoved.length, "stop removed"],
    [d.stopsChanged.length, "stop changed"],
    [d.visitsAdded.length, "visit added"],
    [d.visitsRemoved.length, "visit removed"],
    [d.visitsChanged.length, "time changed"],
  ] as const)
    if (n)
      parts.push(
        `${n} ${n === 1 ? label : label.replace(/^(stop|visit|time)/, "$1s")}`
      )
  if (d.cycleChanged) parts.push("cycle changed")

  return parts.join(", ") || "No timetable changes"
}
