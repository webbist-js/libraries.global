export type OpeningTimesDayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday"
export type OpeningTimesStaffing =
  | "staffed"
  | "volunteer"
  | "self_service"
  | "appointment"
  | "open"
export interface OpeningTimeframe {
  id: string
  startTime: string
  endTime: string
  staffing: OpeningTimesStaffing
  overnight?: boolean
  note?: string
}
export interface OpeningTimesDay {
  day: OpeningTimesDayKey
  enabled: boolean
  timeframes: OpeningTimeframe[]
}
export interface OpeningTimesValue {
  version: number
  days: OpeningTimesDay[]
  exceptions?: OpeningTimesException[]
  seasons?: OpeningTimesSeason[]
}

export interface OpeningTimesException {
  date: string
  timeframes: OpeningTimeframe[]
  note?: string
}
export interface OpeningTimesSeason {
  id: string
  name: string
  from: string
  to: string
  days: OpeningTimesDay[]
}
