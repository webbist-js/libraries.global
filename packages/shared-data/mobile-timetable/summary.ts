import { WEEKDAYS, type MobileTimetable, type Weekday } from "./types"

export function summarizeTimetable(tt: MobileTimetable | null): {
  stopCount: number
  visitCount: number
  cycleWeeks: number
  days: Weekday[]
} {
  if (!tt) return { stopCount: 0, visitCount: 0, cycleWeeks: 0, days: [] }
  const visited = new Set(tt.visits.map((v) => v.stopId))

  return {
    stopCount: tt.stops.filter((s) => visited.has(s.id)).length,
    visitCount: tt.visits.length,
    cycleWeeks: tt.cycle.weeks,
    days: WEEKDAYS.filter((day) => tt.visits.some((v) => v.day === day)),
  }
}
