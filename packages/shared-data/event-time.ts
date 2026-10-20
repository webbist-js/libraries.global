export type EventTimeSlot = "morning" | "afternoon" | "evening" | "allday"

/** Stable venue-local facet, shared by the search projection and the UI. */
export function eventTimeSlot(event: {
  allDay?: unknown
  startTime?: unknown
  timezone?: unknown
}): EventTimeSlot {
  if (event.allDay) return "allday"
  const date = new Date(String(event.startTime ?? ""))
  if (!Number.isFinite(date.getTime())) return "morning"
  let hour: number
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: typeof event.timezone === "string" ? event.timezone : "UTC",
      }).format(date)
    )
  } catch {
    hour = date.getUTCHours()
  }

  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
}
