import {
  DAY_ORDER,
  type OpeningTimesData,
} from "@/components/library-editor/opening-times.types"

export const weeklyHours: OpeningTimesData = {
  version: 2,
  days: DAY_ORDER.map((day, index) => ({
    day,
    enabled: index < 6,
    timeframes:
      index < 6
        ? [
            {
              id: `${day}-staffed`,
              startTime: "09:00",
              endTime: index === 5 ? "13:00" : "17:00",
              staffing: "staffed",
            },
          ]
        : [],
  })),
}
export const splitHours: OpeningTimesData = {
  ...weeklyHours,
  days: weeklyHours.days.map((day) =>
    !day.enabled
      ? day
      : {
          ...day,
          timeframes: [
            {
              id: `${day.day}-morning`,
              startTime: "09:00",
              endTime: "12:30",
              staffing: "staffed",
            },
            {
              id: `${day.day}-afternoon`,
              startTime: "13:30",
              endTime: "18:00",
              staffing: "self_service",
              note: "Library card required for entry.",
            },
          ],
        }
  ),
}
export const overnightHours: OpeningTimesData = {
  version: 2,
  days: DAY_ORDER.map((day) => ({
    day,
    enabled: day === "friday",
    timeframes:
      day === "friday"
        ? [
            {
              id: "evening",
              startTime: "22:00",
              endTime: "02:00",
              overnight: true,
              staffing: "volunteer",
            },
          ]
        : [],
  })),
}
export const scheduleOverrides: OpeningTimesData = {
  ...splitHours,
  exceptions: [
    {
      date: "2026-12-25",
      timeframes: [],
      note: "Closed for the public holiday.",
    },
  ],
  seasons: [
    {
      id: "summer",
      name: "Summer opening",
      from: "2026-06-01",
      to: "2026-08-31",
      days: weeklyHours.days,
    },
  ],
}
