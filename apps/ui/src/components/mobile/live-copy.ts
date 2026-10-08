import type { MobileTimetable, PublicLiveState } from "@repo/shared-data"

import { weekdayCopy, weekdayName } from "@/lib/staff/format"

/** What the public reads for a skipped stop. */
export const NOT_STOPPING_TODAY = "Not stopping today"

/**
 * The public line for a live state: a chip label and one sentence, with the
 * stop names resolved from the timetable. `today` (the library's local
 * date) turns the next service date into "Today", "Tomorrow" or a weekday;
 * `now` gives the stale state its minute count.
 */
export function publicLiveCopy(
  state: PublicLiveState,
  tt: MobileTimetable,
  opts: { today?: string; now?: Date } = {}
): {
  label: string
  sentence: string
  tone: "ok" | "info" | "warn" | "danger" | "neutral"
  icon: string
  pulse: boolean
} {
  const name = (id: string | null | undefined) =>
    tt.stops.find((s) => s.id === id)?.name || "the next stop"
  const when = (date: string) =>
    opts.today ? weekdayCopy(date, opts.today) : weekdayName(date)
  const next = state.nextService
    ? `Next: ${when(state.nextService.date)}, ${name(state.nextService.stopId)} at ${state.nextService.arrive}.`
    : ""
  const skipped = state.skippedStopIds.length
    ? ` ${state.skippedStopIds.length === 1 ? `${name(state.skippedStopIds[0])}: ${NOT_STOPPING_TODAY.toLowerCase()}.` : `${state.skippedStopIds.length} stops: ${NOT_STOPPING_TODAY.toLowerCase()}.`}`
    : ""
  switch (state.kind) {
    case "here":
      return {
        label: "Here now",
        sentence: `At ${name(state.stopId)} until ${state.until ?? "the next stop"}.${skipped}`,
        tone: "ok",
        icon: "mdi:map-marker",
        pulse: true,
      }
    case "road":
      return {
        label: "On the road",
        sentence: `Heading to ${name(state.nextStopId)}, about ${state.expectedAt}.${skipped}`,
        tone: "info",
        icon: "mdi:bus",
        pulse: false,
      }
    case "late":
      return {
        label: `${state.delayMin} min late`,
        sentence: `Expected at ${name(state.nextStopId ?? state.stopId)} about ${state.expectedAt} (timetable ${state.scheduledAt}).${skipped}`,
        tone: "warn",
        icon: "mdi:clock-outline",
        pulse: false,
      }
    case "notrunning":
      return {
        label: "Not running today",
        sentence:
          state.noticeMessage ??
          `This mobile library is not running for the rest of today. ${next}`.trim(),
        tone: "danger",
        icon: "mdi:bus-alert",
        pulse: false,
      }
    case "stale": {
      const minutes =
        opts.now && state.updatedAt
          ? Math.max(
              0,
              Math.round(
                (opts.now.getTime() - Date.parse(state.updatedAt)) / 60_000
              )
            )
          : null
      const since =
        minutes === null
          ? "The last update was over 15 minutes ago"
          : `No update for ${minutes} minutes`
      const scheduled = state.nextService
        ? ` Next scheduled stop: ${name(state.nextService.stopId)} at ${state.nextService.arrive}${state.nextService.date !== opts.today && opts.today ? ` (${when(state.nextService.date)})` : ""}.`
        : ""

      return {
        label: "Timetable",
        sentence: `${since}, so we’re showing the timetable.${scheduled}`,
        tone: "neutral",
        icon: "mdi:calendar",
        pulse: false,
      }
    }
    case "finished":
      return {
        label: "Finished for today",
        sentence: `Finished for today. ${next}`.trim(),
        tone: "neutral",
        icon: "mdi:check",
        pulse: false,
      }

    default:
      return {
        label: "Timetable",
        sentence: state.sharesLive
          ? `No live updates yet today. Showing the timetable. ${next}`.trim()
          : `Times are the published timetable. ${next}`.trim(),
        tone: "neutral",
        icon: "mdi:calendar",
        pulse: false,
      }
  }
}
