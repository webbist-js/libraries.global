import type {
  OpeningTimesDayKey,
  OpeningTimesValue,
} from "../opening-times-shape"
import { addDays } from "./dates"
import { dayRoute } from "./recurrence"
import type { MobileTimetable, TimetableNotice } from "./types"

const DAYS: OpeningTimesDayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

export function weekFrames(
  tt: MobileTimetable,
  notices: TimetableNotice[],
  weekStart: string,
  maxPerDay = 10
): OpeningTimesValue {
  return {
    version: 1,
    days: DAYS.map((day, i) => {
      const frames: { startTime: string; endTime: string }[] = []
      for (const visit of dayRoute(tt, notices, addDays(weekStart, i)).filter(
        (o) => !o.cancelledBy
      )) {
        const last = frames.at(-1)
        if (last && visit.arrive <= last.endTime)
          last.endTime = [last.endTime, visit.depart].sort().at(-1)!
        else frames.push({ startTime: visit.arrive, endTime: visit.depart })
      }

      return {
        day,
        enabled: frames.length > 0,
        timeframes: frames.slice(0, maxPerDay).map((f, j) => ({
          ...f,
          id: `mobile-${day}-${j}`,
          staffing: "staffed" as const,
        })),
      }
    }),
  }
}
