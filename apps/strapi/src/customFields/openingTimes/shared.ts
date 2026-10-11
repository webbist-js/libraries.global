import {
  normalizeOpeningSchedule,
  type OpeningTimesValue,
} from "@repo/shared-data"

export type { OpeningTimesValue } from "@repo/shared-data"

export const OPENING_TIMES_FIELD_NAME = "opening-times"
export const OPENING_TIMES_CUSTOM_FIELD_UID = `global::${OPENING_TIMES_FIELD_NAME}`
export const OPENING_TIMES_VERSION = 2

export const OPENING_TIMES_DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export type OpeningTimesDayKey = (typeof OPENING_TIMES_DAY_ORDER)[number]

export const OPENING_TIMES_DAY_LABELS: Record<OpeningTimesDayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
}

export const OPENING_TIMES_STAFFING_OPTIONS = [
  "staffed",
  "volunteer",
  "self_service",
  "open",
  "appointment",
] as const

export type OpeningTimesStaffing =
  (typeof OPENING_TIMES_STAFFING_OPTIONS)[number]

export const OPENING_TIMES_STAFFING_LABELS: Record<
  OpeningTimesStaffing,
  string
> = {
  staffed: "Staffed",
  volunteer: "Volunteer",
  self_service: "Self service",
  open: "Open · staffing not recorded",
  appointment: "By appointment",
}

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

const TIME_INTERVAL_MINUTES = 15
const MINUTES_PER_DAY = 24 * 60

export const TIME_OPTIONS = Array.from(
  { length: MINUTES_PER_DAY / TIME_INTERVAL_MINUTES + 1 },
  (_, index) => {
    const totalMinutes = index * TIME_INTERVAL_MINUTES
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`
  }
)

export const START_TIME_OPTIONS = TIME_OPTIONS.slice(0, -1)
export const END_TIME_OPTIONS = TIME_OPTIONS.slice(1)

const DEFAULT_START_TIME = "09:00"
const DEFAULT_END_TIME = "17:00"
const DEFAULT_STAFFING: OpeningTimesStaffing = "open"

let fallbackIdCounter = 0

const createId = () => {
  const cryptoApi = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined

  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID()
  }

  fallbackIdCounter += 1

  return `opening-timeframe-${Date.now()}-${fallbackIdCounter}`
}

export const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number)

  return hours * 60 + minutes
}

export const compareTimes = (left: string, right: string) =>
  timeToMinutes(left) - timeToMinutes(right)

export const getNextTimeOption = (time: string) => {
  const currentIndex = TIME_OPTIONS.indexOf(time)

  if (currentIndex === -1 || currentIndex === TIME_OPTIONS.length - 1) {
    return null
  }

  return TIME_OPTIONS[currentIndex + 1] ?? null
}

export const sortTimeframes = (timeframes: OpeningTimeframe[]) =>
  [...timeframes].sort((left, right) => {
    const startComparison = compareTimes(left.startTime, right.startTime)

    if (startComparison !== 0) {
      return startComparison
    }

    return compareTimes(left.endTime, right.endTime)
  })

export const findOverlappingTimeframeIndexes = (
  timeframes: OpeningTimeframe[]
) => {
  const overlappingIndexes = new Set<number>()

  for (let index = 1; index < timeframes.length; index += 1) {
    const previous = timeframes[index - 1]
    const current = timeframes[index]

    if (compareTimes(current.startTime, previous.endTime) < 0) {
      overlappingIndexes.add(index - 1)
      overlappingIndexes.add(index)
    }
  }

  return overlappingIndexes
}

export const createDefaultTimeframe = (): OpeningTimeframe => ({
  id: createId(),
  startTime: DEFAULT_START_TIME,
  endTime: DEFAULT_END_TIME,
  staffing: DEFAULT_STAFFING,
})

export const cloneTimeframe = (
  timeframe: Pick<
    OpeningTimeframe,
    "startTime" | "endTime" | "staffing" | "overnight" | "note"
  >
): OpeningTimeframe => ({
  id: createId(),
  startTime: timeframe.startTime,
  endTime: timeframe.endTime,
  staffing: timeframe.staffing,
  ...(timeframe.overnight ? { overnight: true } : {}),
  ...(timeframe.note ? { note: timeframe.note } : {}),
})

export const createDefaultOpeningTimesValue = (): OpeningTimesValue => ({
  version: OPENING_TIMES_VERSION,
  days: OPENING_TIMES_DAY_ORDER.map((day) => ({
    day,
    enabled: false,
    timeframes: [],
  })),
})

export const normalizeOpeningTimesValue = (value: unknown): OpeningTimesValue =>
  normalizeOpeningSchedule(value)
