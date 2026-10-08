import { addDays, epochWeek, positiveModulo, weekdayOf } from "./dates"
import type { MobileTimetable } from "./types"

export function stopKeys(
  tt: MobileTimetable,
  stopId: string,
  today: string
): string[] {
  const keys = new Set<string>()
  for (const visit of tt.visits) {
    if (
      visit.stopId !== stopId ||
      (visit.validFrom && visit.validFrom > today) ||
      (visit.validTo && visit.validTo < today)
    )
      continue
    if (visit.repeat.kind === "cycle")
      for (const week of visit.repeat.weeks)
        keys.add(
          `c${tt.cycle.weeks}.${positiveModulo(epochWeek(tt.cycle.anchor) + week - 1, tt.cycle.weeks)}.${visit.day}`
        )
    else if (visit.repeat.kind === "monthly")
      keys.add(`m${visit.repeat.nth}.${visit.day}`)
    else for (const date of visit.repeat.dates) keys.add(`d.${date}`)
  }

  return [...keys].sort()
}
export function todayKeys(date: string): string[] {
  const day = weekdayOf(date),
    keys = [1, 2, 3, 4].map(
      (n) => `c${n}.${positiveModulo(epochWeek(date), n)}.${day}`
    )
  const nth = Math.ceil(Number(date.slice(-2)) / 7)
  if (nth <= 4) keys.push(`m${nth}.${day}`)
  if (addDays(date, 7).slice(0, 7) !== date.slice(0, 7)) keys.push(`m-1.${day}`)

  return [...keys, `d.${date}`]
}
export function weekKeys(fromDate: string): string[] {
  return [
    ...new Set(
      Array.from({ length: 7 }, (_, i) =>
        todayKeys(addDays(fromDate, i))
      ).flat()
    ),
  ]
}
