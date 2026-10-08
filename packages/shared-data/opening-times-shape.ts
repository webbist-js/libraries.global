export type OpeningTimesDayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday"
export type OpeningTimesStaffing = "staffed" | "volunteer" | "self_service"
export interface OpeningTimeframe {
  id: string
  startTime: string
  endTime: string
  staffing: OpeningTimesStaffing
}
export interface OpeningTimesDay {
  day: OpeningTimesDayKey
  enabled: boolean
  timeframes: OpeningTimeframe[]
}
export interface OpeningTimesValue {
  version: number
  days: OpeningTimesDay[]
}
