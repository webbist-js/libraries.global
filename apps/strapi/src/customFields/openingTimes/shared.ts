export const OPENING_TIMES_FIELD_NAME = "opening-times"
export const OPENING_TIMES_CUSTOM_FIELD_UID = `global::${OPENING_TIMES_FIELD_NAME}`
export const OPENING_TIMES_VERSION = 1

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
}

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

const START_TIME_SET = new Set(START_TIME_OPTIONS)
const END_TIME_SET = new Set(END_TIME_OPTIONS)
const STAFFING_SET = new Set<OpeningTimesStaffing>(
  OPENING_TIMES_STAFFING_OPTIONS
)

const DEFAULT_START_TIME = "09:00"
const DEFAULT_END_TIME = "17:00"
const DEFAULT_STAFFING: OpeningTimesStaffing = "staffed"

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

const isOpeningTimesDayKey = (value: unknown): value is OpeningTimesDayKey =>
  typeof value === "string" &&
  OPENING_TIMES_DAY_ORDER.includes(value as OpeningTimesDayKey)

const isOpeningTimesStaffing = (
  value: unknown
): value is OpeningTimesStaffing =>
  typeof value === "string" && STAFFING_SET.has(value as OpeningTimesStaffing)

const isValidStartTime = (value: unknown): value is string =>
  typeof value === "string" && START_TIME_SET.has(value)

const isValidEndTime = (value: unknown): value is string =>
  typeof value === "string" && END_TIME_SET.has(value)

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
  timeframe: Pick<OpeningTimeframe, "startTime" | "endTime" | "staffing">
): OpeningTimeframe => ({
  id: createId(),
  startTime: timeframe.startTime,
  endTime: timeframe.endTime,
  staffing: timeframe.staffing,
})

export const createDefaultOpeningTimesValue = (): OpeningTimesValue => ({
  version: OPENING_TIMES_VERSION,
  days: OPENING_TIMES_DAY_ORDER.map((day) => ({
    day,
    enabled: false,
    timeframes: [],
  })),
})

const normalizeTimeframe = (value: unknown): OpeningTimeframe => {
  const timeframe =
    value != null && typeof value === "object"
      ? (value as Partial<OpeningTimeframe>)
      : {}

  const startTime = isValidStartTime(timeframe.startTime)
    ? timeframe.startTime
    : DEFAULT_START_TIME
  const nextStartTime = getNextTimeOption(startTime) ?? DEFAULT_END_TIME

  const endTime =
    isValidEndTime(timeframe.endTime) &&
    compareTimes(startTime, timeframe.endTime) < 0
      ? timeframe.endTime
      : nextStartTime

  return {
    id:
      typeof timeframe.id === "string" && timeframe.id.length > 0
        ? timeframe.id
        : createId(),
    startTime,
    endTime,
    staffing: isOpeningTimesStaffing(timeframe.staffing)
      ? timeframe.staffing
      : DEFAULT_STAFFING,
  }
}

const normalizeDay = (
  dayKey: OpeningTimesDayKey,
  value: unknown
): OpeningTimesDay => {
  const day =
    value != null && typeof value === "object"
      ? (value as Partial<OpeningTimesDay>)
      : {}
  const rawTimeframes = Array.isArray(day.timeframes) ? day.timeframes : []

  return {
    day: dayKey,
    enabled: day.enabled === true,
    timeframes: sortTimeframes(rawTimeframes.map(normalizeTimeframe)),
  }
}

export const normalizeOpeningTimesValue = (
  value: unknown
): OpeningTimesValue => {
  const fallbackValue = createDefaultOpeningTimesValue()

  if (value == null || typeof value !== "object") {
    return fallbackValue
  }

  const record = value as Record<string, unknown>
  const daysArray = Array.isArray(record.days) ? record.days : null
  const daysByKey = new Map<OpeningTimesDayKey, unknown>()

  if (daysArray != null) {
    for (const day of daysArray) {
      if (
        day != null &&
        typeof day === "object" &&
        isOpeningTimesDayKey(day.day)
      ) {
        daysByKey.set(day.day, day)
      }
    }
  } else {
    for (const dayKey of OPENING_TIMES_DAY_ORDER) {
      daysByKey.set(dayKey, record[dayKey])
    }
  }

  return {
    version:
      typeof record.version === "number"
        ? record.version
        : OPENING_TIMES_VERSION,
    days: OPENING_TIMES_DAY_ORDER.map((dayKey) =>
      normalizeDay(dayKey, daysByKey.get(dayKey))
    ),
  }
}
