import { localDateTime, toMinutes } from "@repo/shared-data"

import type { ConsoleEvent, ConsoleSession } from "./types"

/** Queued check-ins stay visible until the server returns its authoritative fold. */
export function applyQueuedCheckin(
  session: ConsoleSession,
  event: ConsoleEvent,
  timezone: string
): ConsoleSession {
  const state = { ...session.state }
  const done = new Set(state.completedVisitIds)
  const visit =
    event.type === "left"
      ? session.route.find((v) => v.visitId === state.currentVisitId)
      : session.route.find(
          (v) =>
            v.stopId === event.stopId &&
            !done.has(v.visitId) &&
            v.visitId !== state.currentVisitId
        )
  if (event.type === "arrived" && visit) {
    if (state.currentVisitId) done.add(state.currentVisitId)
    state.phase = "at_stop"
    state.currentStopId = visit.stopId
    state.currentVisitId = visit.visitId
    state.currentSince = event.clientAt
    const local = localDateTime(new Date(event.clientAt), timezone)
    const delayMin = Math.max(
      0,
      (Date.parse(`${local.date}T00:00:00Z`) -
        Date.parse(`${visit.date}T00:00:00Z`)) /
        60_000 +
        local.minute -
        toMinutes(visit.arrive)
    )
    state.arrivals = [
      ...(state.arrivals ?? []).filter((a) => a.visitId !== visit.visitId),
      { visitId: visit.visitId, delayMin },
    ]
    state.delayMin = Math.max(state.delayMin, delayMin)
  } else if (event.type === "left" && visit) {
    done.add(visit.visitId)
    state.phase = "between"
  } else if (event.type === "skip" && visit) {
    done.add(visit.visitId)
    state.skipped = [
      ...state.skipped,
      {
        stopId: visit.stopId,
        visitId: visit.visitId,
        reason: event.reason ?? "",
      },
    ]
  } else if (event.type === "delay") {
    state.delayMin = Math.max(
      event.delayMin ?? 0,
      state.arrivals?.at(-1)?.delayMin ?? 0
    )
  }
  state.completedVisitIds = [...done]
  const next = session.route.find(
    (v) => !done.has(v.visitId) && v.visitId !== state.currentVisitId
  )
  state.nextStopId = next?.stopId ?? null
  state.nextVisitId = next?.visitId
  state.lastEventAt = event.clientAt

  return { ...session, state }
}
