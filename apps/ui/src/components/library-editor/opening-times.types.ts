// Canonical opening-times shape, matching the global::opening-times custom
// field. Plain data only: this module is imported on the server (form
// defaults) as well as by the client editor.

export const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export type OpeningTimesDayKey = (typeof DAY_ORDER)[number]

export const DAY_LABELS: Record<OpeningTimesDayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
}

export type {
  OpeningTimesStaffing,
  OpeningTimeframe,
  OpeningTimesDay,
} from "@repo/shared-data"
import type { OpeningTimesValue } from "@repo/shared-data"

export type OpeningTimesData = OpeningTimesValue

export function emptyOpeningTimes(): OpeningTimesData {
  return {
    version: 2,
    days: DAY_ORDER.map((day) => ({ day, enabled: false, timeframes: [] })),
  }
}
