import {
  addDays,
  isCalendarDate,
  localDateTime,
  WEEKDAYS,
  weekdayOf,
} from "./mobile-timetable"
import type {
  OpeningTimeframe,
  OpeningTimesDay,
  OpeningTimesStaffing,
  OpeningTimesValue,
} from "./opening-times-shape"

export const OPENING_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const
const openingDayOf = (date: string) =>
  OPENING_WEEKDAYS[WEEKDAYS.indexOf(weekdayOf(date))]!

export const OPENING_MODES = [
  "open",
  "staffed",
  "self_service",
  "volunteer",
  "appointment",
] as const
export const OPENING_MODE_LABELS: Record<OpeningTimesStaffing, string> = {
  open: "Open · staffing not recorded",
  staffed: "Staffed",
  self_service: "Self-service",
  volunteer: "Volunteer-run",
  appointment: "By appointment",
}
export const openingMinute = (value: unknown): number | null => {
  if (
    typeof value !== "string" ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(value)
  )
    return null
  const [hour, minute] = value.split(":").map(Number)

  return hour! * 60 + minute!
}
/** Preserve invalid values for correction. Only an absent legacy mode is adapted to unknown staffing. */
export function normalizeOpeningSchedule(input: unknown): OpeningTimesValue {
  const data = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >
  const frames = (value: unknown): OpeningTimeframe[] =>
    !Array.isArray(value)
      ? []
      : value
          .map((raw, n) => {
            const frame = (raw && typeof raw === "object" ? raw : {}) as Record<
              string,
              unknown
            >

            return {
              ...frame,
              id: typeof frame.id === "string" ? frame.id : `legacy-${n}`,
              startTime:
                typeof frame.startTime === "string" ? frame.startTime : "",
              endTime: typeof frame.endTime === "string" ? frame.endTime : "",
              staffing: (frame.staffing ?? "open") as OpeningTimesStaffing,
            } as OpeningTimeframe
          })
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const days = (value: unknown): OpeningTimesDay[] =>
    OPENING_WEEKDAYS.map((day) => {
      const row = (
        Array.isArray(value)
          ? value.find((r) => r?.day === day)
          : (value as Record<string, unknown> | null)?.[day]
      ) as Partial<OpeningTimesDay> | undefined

      return {
        day,
        enabled: row?.enabled === true,
        timeframes: frames(row?.timeframes),
      }
    })

  return {
    ...data,
    version: 2,
    days: days(data.days ?? data),
    ...(Array.isArray(data.exceptions)
      ? {
          exceptions: data.exceptions
            .filter((row) => row && typeof row === "object")
            .map((row) => ({
              ...row,
              timeframes: frames(row.timeframes),
            })),
        }
      : {}),
    ...(Array.isArray(data.seasons)
      ? {
          seasons: data.seasons
            .filter((row) => row && typeof row === "object")
            .map((row) => ({
              ...row,
              days: days(row.days),
            })),
        }
      : {}),
  }
}
export function validateOpeningSchedule(input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return ["Set a valid opening schedule"]
  const raw = input as Record<string, unknown>
  if (!Array.isArray(raw.days) && !OPENING_WEEKDAYS.some((day) => day in raw))
    return ["Set the regular week before adding overrides"]
  if (
    Array.isArray(raw.days) &&
    raw.days.some(
      (row) =>
        !row || typeof row !== "object" || !OPENING_WEEKDAYS.includes(row.day)
    )
  )
    return ["Opening days must use known weekdays"]
  if (
    ["exceptions", "seasons"].some(
      (key) =>
        raw[key] !== undefined &&
        (!Array.isArray(raw[key]) ||
          (raw[key] as unknown[]).some(
            (row) => !row || typeof row !== "object"
          ))
    )
  )
    return ["Schedule overrides must be valid entries"]
  const rawDays = Array.isArray(raw.days)
    ? raw.days
    : OPENING_WEEKDAYS.flatMap((day) => (raw[day] ? [raw[day]] : []))
  if (
    rawDays.some(
      (row) =>
        (row.enabled !== undefined && typeof row.enabled !== "boolean") ||
        (row.timeframes !== undefined && !Array.isArray(row.timeframes))
    )
  )
    return ["Days need a Yes/No opening state and a list of blocks"]
  if (
    new Set(rawDays.map((row) => row.day).filter(Boolean)).size !==
    rawDays.filter((row) => row.day).length
  )
    return ["Use one entry per weekday"]
  const value = normalizeOpeningSchedule(input),
    errors: string[] = []
  const checkFrames = (frames: OpeningTimeframe[], label: string) => {
    if (frames.length > 10) errors.push(`${label}: at most 10 opening blocks`)
    const ranges: [number, number][] = []
    frames.forEach((frame) => {
      const start = openingMinute(frame.startTime),
        end = openingMinute(frame.endTime)
      if (frame.overnight !== undefined && typeof frame.overnight !== "boolean")
        errors.push(`${label}: next-day must be Yes or No`)
      if (!OPENING_MODES.includes(frame.staffing))
        errors.push(`${label}: unknown opening mode`)
      if (
        start === null ||
        end === null ||
        start === 1440 ||
        (frame.overnight ? end >= start : end <= start)
      )
        errors.push(
          `${label}: enter a positive range; use next-day for overnight hours`
        )
      else ranges.push([start, end + (frame.overnight ? 1440 : 0)])
      if (
        frame.note !== undefined &&
        (typeof frame.note !== "string" || frame.note.length > 1000)
      )
        errors.push(`${label}: access notes must be at most 1,000 characters`)
    })
    ranges.sort((a, b) => a[0] - b[0])
    if (ranges.some((range, n) => n > 0 && range[0] < ranges[n - 1]![1]))
      errors.push(`${label}: opening blocks overlap`)
  }
  const checkWeek = (days: OpeningTimesDay[], label: string) => {
    days.forEach((day, n) => {
      checkFrames(day.timeframes, `${label} ${day.day}`)
      if (!day.enabled) return
      const previous = days[(n + 6) % 7]!
      const carry = previous.enabled
        ? previous.timeframes
            .filter((f) => f.overnight)
            .map((f) => openingMinute(f.endTime) ?? 0)
        : []
      if (
        day.timeframes.some((f) =>
          carry.some((end) => (openingMinute(f.startTime) ?? 1440) < end)
        )
      )
        errors.push(
          `${label} ${day.day}: overlaps the previous day's overnight block`
        )
    })
  }
  checkWeek(value.days, "Regular week")
  if (
    (value.exceptions?.length ?? 0) > 366 ||
    (value.seasons?.length ?? 0) > 32
  )
    errors.push("Too many schedule overrides")
  const dates = new Set<string>()
  value.exceptions?.forEach((row) => {
    if (!isCalendarDate(row.date) || dates.has(row.date))
      errors.push("Exceptions need unique valid calendar dates")
    dates.add(row.date)
    checkFrames(row.timeframes, row.date)
  })
  value.seasons?.forEach((row, n) => {
    if (
      !isCalendarDate(row.from) ||
      !isCalendarDate(row.to) ||
      row.to < row.from
    )
      errors.push("Seasons need a valid start and end date")
    if (
      value.seasons!.some(
        (other, i) => i < n && other.from <= row.to && row.from <= other.to
      )
    )
      errors.push(
        "Season dates overlap; choose one replacement schedule per date"
      )
    checkWeek(row.days, row.name || "Season")
  })

  return [...new Set(errors)]
}
/** Each override replaces the schedule. A dated exception wins over a season. */
export function openingScheduleForDate(input: unknown, date: string): unknown {
  if (!input || typeof input !== "object") return input
  const value = normalizeOpeningSchedule(input)
  const exception = value.exceptions?.find((row) => row.date === date)
  if (exception)
    return {
      version: 2,
      days: [
        {
          day: openingDayOf(date),
          enabled: exception.timeframes.length > 0,
          timeframes: exception.timeframes,
        },
      ],
    }
  const season = value.seasons?.find(
    (row) => row.from <= date && date <= row.to
  )

  return season ? { version: 2, days: season.days } : input
}
export function openingScheduleStatus(
  input: unknown,
  timezone: string | null | undefined,
  now: Date,
  resolve: (date: string) => { hours: unknown; closed: boolean } = (date) => ({
    hours: openingScheduleForDate(input, date),
    closed:
      normalizeOpeningSchedule(input).exceptions?.some(
        (row) => row.date === date && !row.timeframes.length
      ) ?? false,
  })
) {
  if (!timezone)
    return { state: "unknown" as const, label: "Local timezone not recorded" }
  let local: ReturnType<typeof localDateTime>
  try {
    local = localDateTime(now, timezone)
  } catch {
    return { state: "unknown" as const, label: "Local timezone not recorded" }
  }
  if (input != null && validateOpeningSchedule(input).length)
    return { state: "unknown" as const, label: "Recorded hours need checking" }
  const base = normalizeOpeningSchedule(input)
  if (
    !base.days.some((day) => day.enabled && day.timeframes.length) &&
    !base.exceptions?.some((row) => row.timeframes.length) &&
    !base.seasons?.some((row) =>
      row.days.some((day) => day.enabled && day.timeframes.length)
    ) &&
    !Array.from({ length: 7 }, (_, offset) =>
      normalizeOpeningSchedule(resolve(addDays(local.date, offset)).hours)
    ).some((value) =>
      value.days.some((day) => day.enabled && day.timeframes.length)
    )
  )
    return resolve(local.date).closed
      ? { state: "closed" as const, label: "Closed today" }
      : { state: "unknown" as const, label: "Hours not added yet" }
  const validFrame = (frame: OpeningTimeframe) =>
    openingMinute(frame.startTime) !== null &&
    openingMinute(frame.endTime) !== null
  const framesOn = (date: string) => {
    const effective = resolve(date)
    if (effective.closed) return []
    const value = normalizeOpeningSchedule(effective.hours)
    const day = value.days.find((row) => row.day === openingDayOf(date))!
    const frames = day.enabled
      ? day.timeframes.filter(validFrame).map((frame) => ({
          frame,
          start: openingMinute(frame.startTime)!,
          end: openingMinute(frame.endTime)! + (frame.overnight ? 1440 : 0),
        }))
      : []
    const previous = addDays(date, -1),
      before = resolve(previous)
    const beforeDay = normalizeOpeningSchedule(before.hours).days.find(
      (row) => row.day === openingDayOf(previous)
    )!
    if (!before.closed && beforeDay.enabled)
      frames.push(
        ...beforeDay.timeframes
          .filter((frame) => frame.overnight && validFrame(frame))
          .map((frame) => ({
            frame,
            start: 0,
            end: openingMinute(frame.endTime)!,
          }))
      )

    return frames.sort((a, b) => a.start - b.start)
  }
  if (resolve(local.date).closed)
    return { state: "closed" as const, label: "Closed today" }
  const today = framesOn(local.date)
  const active = today.find(
    (row) => row.start <= local.minute && local.minute < row.end
  )
  if (active) {
    const mode = active.frame.staffing
    const note = active.frame.note ? ` · ${active.frame.note}` : ""
    const prefix =
      mode === "appointment"
        ? "By appointment"
        : mode === "self_service"
          ? "Open · self-service"
          : mode === "volunteer"
            ? "Open · volunteer-run"
            : mode === "staffed"
              ? "Open · staffed"
              : "Open"

    return {
      state:
        mode === "appointment" ? ("appointment" as const) : ("open" as const),
      mode,
      until: active.frame.endTime,
      label: `${prefix} until ${active.frame.endTime}${active.end > 1440 ? " tomorrow" : " today"}${note}`,
    }
  }
  for (let offset = 0; offset < 60; offset++) {
    const date = addDays(local.date, offset)
    const next = framesOn(date).find(
      (row) => offset > 0 || row.start > local.minute
    )
    if (next)
      return {
        state: "closed" as const,
        label: `Closed · ${next.frame.staffing === "appointment" ? "appointments from" : "opens"} ${next.frame.startTime} ${offset === 0 ? "today" : offset === 1 ? "tomorrow" : offset < 7 ? openingDayOf(date).replace(/^./, (letter) => letter.toUpperCase()) : date}`,
      }
  }

  return {
    state: input == null ? ("unknown" as const) : ("closed" as const),
    label:
      input == null
        ? "Hours not added yet"
        : "No opening recorded in the next 60 days",
  }
}
