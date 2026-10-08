import { localDateTime, toMinutes, type Occurrence } from "@repo/shared-data"

export type EventType =
  | "start"
  | "arrived"
  | "left"
  | "delay"
  | "skip"
  | "not_running"
  | "end"
export type LiveEvent = {
  id: string
  type: EventType
  stopId: string | null
  delayMin: number
  reason: string
  clientAt: string
  at: string
  /** Set on server-made audit events (a rejected speed), which carry no report. */
  flagged?: string | null
}
export type SessionState = {
  phase: "before" | "at_stop" | "between" | "ended"
  currentStopId: string | null
  nextStopId: string | null
  currentVisitId?: string
  nextVisitId?: string
  currentSince?: string
  arrivals?: { visitId: string; delayMin: number }[]
  averageDelayMin?: number
  completedVisitIds?: string[]
  delayMin: number
  skipped: { stopId: string; visitId?: string; reason: string }[]
  eventCount?: number
  lastEventAt: string | null
}
export const EMPTY_STATE: SessionState = {
  phase: "before",
  currentStopId: null,
  nextStopId: null,
  delayMin: 0,
  skipped: [],
  lastEventAt: null,
}

/** A full fold makes retries and delayed, out-of-order check-ins deterministic. */
export function foldEvents(
  route: Occurrence[],
  events: LiveEvent[],
  tz: string
): SessionState {
  const state: SessionState = {
    ...EMPTY_STATE,
    nextStopId: route[0]?.stopId ?? null,
    nextVisitId: route[0]?.visitId,
    arrivals: [],
    skipped: [],
  }
  const done = new Set<string>()
  const arrivals = new Map<string, number>()
  let reportedDelay = 0
  let arrivalDelay = 0
  for (const event of [...events].sort(
    (a, b) => a.clientAt.localeCompare(b.clientAt) || a.id.localeCompare(b.id)
  )) {
    const stop =
      event.type === "left" &&
      state.currentVisitId &&
      state.currentStopId === event.stopId
        ? route.find(
            (v) =>
              v.visitId === state.currentVisitId && v.stopId === event.stopId
          )
        : (route.find(
            (v) =>
              v.stopId === event.stopId &&
              !done.has(v.visitId) &&
              v.visitId !== state.currentVisitId
          ) ??
          (event.type === "skip"
            ? route.find(
                (v) =>
                  v.visitId === state.currentVisitId &&
                  !done.has(v.visitId) &&
                  v.stopId === event.stopId
              )
            : undefined))
    if (event.type === "arrived" && stop) {
      if (state.currentVisitId && state.currentVisitId !== stop.visitId)
        done.add(state.currentVisitId)
      state.phase = "at_stop"
      state.currentStopId = stop.stopId
      state.currentVisitId = stop.visitId
      state.currentSince = event.clientAt
      const arrivalLocal = localDateTime(new Date(event.clientAt), tz)
      arrivalDelay = Math.max(
        0,
        (Date.parse(`${arrivalLocal.date}T00:00:00Z`) -
          Date.parse(`${stop.date}T00:00:00Z`)) /
          60_000 +
          arrivalLocal.minute -
          toMinutes(stop.arrive)
      )
      arrivals.set(stop.visitId, arrivalDelay)
    } else if (event.type === "left" && stop) {
      done.add(stop.visitId)
      state.phase = "between"
      state.currentStopId = stop.stopId
    } else if (event.type === "skip" && stop) {
      done.add(stop.visitId)
      state.skipped = [
        ...state.skipped.filter((s) => s.visitId !== stop.visitId),
        { stopId: stop.stopId, visitId: stop.visitId, reason: event.reason },
      ]
      if (state.currentStopId === stop.stopId) state.phase = "between"
    } else if (event.type === "delay") {
      // A flagged event only records the rejection; the crew's last report stands.
      if (!event.flagged) reportedDelay = event.delayMin
    } else if (event.type === "end" || event.type === "not_running")
      state.phase = "ended"
    state.delayMin = Math.max(reportedDelay, arrivalDelay)
    state.completedVisitIds = [...done]
    const next = route.find(
      (v) => !done.has(v.visitId) && v.visitId !== state.currentVisitId
    )
    state.nextStopId = next?.stopId ?? null
    state.nextVisitId = next?.visitId
    state.lastEventAt =
      !state.lastEventAt || event.at > state.lastEventAt
        ? event.at
        : state.lastEventAt
  }
  state.arrivals = [...arrivals].map(([visitId, delayMin]) => ({
    visitId,
    delayMin,
  }))
  state.averageDelayMin = arrivals.size
    ? Math.round(
        [...arrivals.values()].reduce((a, b) => a + b, 0) / arrivals.size
      )
    : 0
  state.eventCount = events.length

  return state
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad

  return (
    6371 *
    2 *
    Math.atan2(
      Math.sqrt(
        Math.sin(dLat / 2) ** 2 +
          Math.cos(a.lat * rad) *
            Math.cos(b.lat * rad) *
            Math.sin(dLng / 2) ** 2
      ),
      Math.sqrt(
        Math.max(
          0,
          1 -
            (Math.sin(dLat / 2) ** 2 +
              Math.cos(a.lat * rad) *
                Math.cos(b.lat * rad) *
                Math.sin(dLng / 2) ** 2)
        )
      )
    )
  )
}

/** Distance to the planned polyline, rather than only its stop pins. */
export function inRouteCorridor(
  fix: { lat: number; lng: number },
  pins: { lat: number; lng: number }[],
  home: { lat: number; lng: number } | null
): boolean {
  if (home && distanceKm(fix, home) <= 3) return true
  if (pins.some((pin) => distanceKm(fix, pin) <= 3)) return true
  const scale = Math.cos((fix.lat * Math.PI) / 180)
  for (let i = 1; i < pins.length; i++) {
    const a = pins[i - 1]!
    const b = pins[i]!
    const dx = (b.lng - a.lng) * scale,
      dy = b.lat - a.lat
    const length = dx * dx + dy * dy
    const t = length
      ? Math.max(
          0,
          Math.min(
            1,
            ((fix.lng - a.lng) * scale * dx + (fix.lat - a.lat) * dy) / length
          )
        )
      : 0
    if (
      distanceKm(fix, {
        lat: a.lat + t * dy,
        lng: a.lng + t * (b.lng - a.lng),
      }) <= 3
    )
      return true
  }

  return false
}

export function localInstant(date: string, minute: number, tz: string): Date {
  let epoch = Date.parse(`${date}T00:00:00Z`) + minute * 60_000
  for (let i = 0; i < 4; i++) {
    const actual = localDateTime(new Date(epoch), tz)
    const delta =
      (Date.parse(`${date}T00:00:00Z`) -
        Date.parse(`${actual.date}T00:00:00Z`)) /
        60_000 +
      minute -
      actual.minute
    epoch += delta * 60_000
    if (!delta) break
  }

  return new Date(epoch)
}
