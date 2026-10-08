import { addDays, fromMinutes, localDateTime, toMinutes } from "./dates"
import {
  dayRoute,
  occurrences,
  scheduleState,
  type Occurrence,
} from "./recurrence"
import type { MobileTimetable, TimetableNotice } from "./types"

export type LiveEndReason =
  | "manual"
  | "auto"
  | "breakdown"
  | "takeover"
  | "revoked"
  | "expired"
  | "kill_switch"
export interface LiveSessionSnapshot {
  status: "active" | "ended"
  endReason: LiveEndReason | null
  serviceDate: string
  phase: "before" | "at_stop" | "between" | "ended"
  currentStopId: string | null
  currentVisitId?: string
  nextVisitId?: string
  nextStopId: string | null
  delayMin: number
  skipped: { stopId: string; reason: string }[]
  lastEventAt: string | null
  publishedPosition: { lat: number; lng: number } | null
  /** Selected day's route, with today's date, when the crew swaps a service day. */
  route?: Occurrence[]
}
export type PublicLiveKind =
  | "here"
  | "road"
  | "late"
  | "notrunning"
  | "timetable"
  | "stale"
  | "finished"
export interface PublicLiveState {
  libraryDocumentId: string
  kind: PublicLiveKind
  sharesLive: boolean
  stopId: string | null
  nextStopId: string | null
  until: string | null
  scheduledAt: string | null
  expectedAt: string | null
  delayMin: number
  noticeMessage: string | null
  nextService: { date: string; stopId: string; arrive: string } | null
  position: { lat: number; lng: number } | null
  skippedStopIds: string[]
  updatedAt: string | null
}
export const LIVE_STALE_MINUTES = 15

/** Cell centres in a local equirectangular grid. Neither axis retains a raw fix. */
export function snapToGrid(
  lat: number,
  lng: number
): { lat: number; lng: number } {
  const dy = 250 / 111_320
  const y = (Math.floor(lat / dy) + 0.5) * dy
  const dx = 250 / (111_320 * Math.max(0.01, Math.cos((y * Math.PI) / 180)))

  return {
    lat: Math.max(-90, Math.min(90, y)),
    lng: Math.max(-180, Math.min(180, (Math.floor(lng / dx) + 0.5) * dx)),
  }
}

export function publicLiveState(input: {
  libraryDocumentId: string
  tt: MobileTimetable
  notices: TimetableNotice[]
  session: LiveSessionSnapshot | null
  sharesLive: boolean
  now: Date
  tz: string
}): PublicLiveState {
  const { tt, notices, now, tz, sharesLive } = input
  const local = localDateTime(now, tz)
  const schedule = scheduleState(tt, notices, now, tz)
  const next =
    occurrences(tt, notices, local.date, addDays(local.date, 183)).find(
      (v) =>
        !v.cancelledBy &&
        (v.date > local.date || toMinutes(v.arrive) > local.minute)
    ) ?? null
  const base: PublicLiveState = {
    libraryDocumentId: input.libraryDocumentId,
    kind: "timetable",
    sharesLive,
    stopId: null,
    nextStopId: null,
    until: null,
    scheduledAt: null,
    expectedAt: null,
    delayMin: 0,
    noticeMessage: null,
    nextService: next
      ? { date: next.date, stopId: next.stopId, arrive: next.arrive }
      : null,
    position: null,
    skippedStopIds: [],
    updatedAt: null,
  }
  if (schedule.kind === "not_running")
    return {
      ...base,
      kind: "notrunning",
      noticeMessage:
        notices.find((n) => n.id === schedule.noticeId)?.message ?? null,
    }
  const session =
    sharesLive && input.session?.serviceDate === local.date
      ? input.session
      : null
  if (!session)
    return {
      ...base,
      kind: schedule.kind === "finished" ? "finished" : "timetable",
    }
  const state = {
    ...base,
    delayMin: session.delayMin,
    skippedStopIds: session.skipped.map((s) => s.stopId),
    updatedAt: session.lastEventAt,
  }
  if (session.endReason === "breakdown") return { ...state, kind: "notrunning" }
  if (session.status === "ended")
    return {
      ...state,
      kind: ["manual", "auto", "expired"].includes(session.endReason ?? "")
        ? "finished"
        : "timetable",
    }
  if (
    !session.lastEventAt ||
    now.getTime() - Date.parse(session.lastEventAt) >=
      LIVE_STALE_MINUTES * 60_000
  )
    return { ...state, kind: "stale" }
  const route =
    session.route ??
    dayRoute(tt, notices, local.date).filter((v) => !v.cancelledBy)
  const current = route.find((v) =>
    session.currentVisitId
      ? v.visitId === session.currentVisitId
      : v.stopId === session.currentStopId
  )
  const following = route.find((v) =>
    session.nextVisitId
      ? v.visitId === session.nextVisitId
      : v.stopId === session.nextStopId
  )
  if (session.phase === "at_stop" && current)
    return {
      ...state,
      kind: session.delayMin >= 5 ? "late" : "here",
      stopId: current.stopId,
      nextStopId: following?.stopId ?? null,
      until: fromMinutes(
        Math.min(1439, toMinutes(current.depart) + session.delayMin)
      ),
      scheduledAt: current.arrive,
      expectedAt: fromMinutes(
        Math.min(1439, toMinutes(current.arrive) + session.delayMin)
      ),
    }
  if (session.phase === "between" && following)
    return {
      ...state,
      kind: session.delayMin >= 5 ? "late" : "road",
      stopId: current?.stopId ?? null,
      nextStopId: following.stopId,
      scheduledAt: following.arrive,
      expectedAt: fromMinutes(
        Math.min(1439, toMinutes(following.arrive) + session.delayMin)
      ),
      position: session.publishedPosition,
    }
  if (!following && session.phase === "between")
    return { ...state, kind: "finished" }

  return state
}
