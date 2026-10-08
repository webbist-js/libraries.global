export const MOBILE_TIMETABLE_VERSION = 1
export const MOBILE_TIMETABLE_FIELD_NAME = "mobile-timetable"
export const MOBILE_TIMETABLE_CUSTOM_FIELD_UID = "global::mobile-timetable"
export const MOBILE_TIMETABLE_LIMITS = {
  stops: 300,
  visits: 600,
  datesPerVisit: 52,
  bytes: 200_000,
  nameMax: 80,
  whereMax: 140,
} as const
export const WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const
export type Weekday = (typeof WEEKDAYS)[number]
export type VisitRepeat =
  | { kind: "cycle"; weeks: number[] }
  | { kind: "monthly"; nth: 1 | 2 | 3 | 4 | -1 }
  | { kind: "dates"; dates: string[] }
export interface MobileStop {
  id: string
  name: string
  where: string
  location: { lat: number; lng: number } | null
  areaDocumentId: string | null
}
export interface MobileVisit {
  id: string
  stopId: string
  day: Weekday
  arrive: string
  depart: string
  repeat: VisitRepeat
  termTimeOnly: boolean
  validFrom: string | null
  validTo: string | null
}
export interface MobileTimetable {
  version: 1
  cycle: { weeks: 1 | 2 | 3 | 4; anchor: string }
  stops: MobileStop[]
  visits: MobileVisit[]
}
export interface TimetableNotice {
  id: string
  type:
    | "not_running"
    | "times_changed"
    | "stop_moved"
    | "extra_visit"
    | "closure"
    | "changed_hours"
    | "service"
  scope: "library" | "service" | "day" | "stop" | "term_time"
  scopeWeek: number | null
  scopeDay: Weekday | null
  stopId: string | null
  from: string
  to: string | null
  endedAt: string | null
  message: string
  reason: string | null
}
