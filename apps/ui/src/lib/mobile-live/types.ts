import type { MobileTimetable, Occurrence } from "@repo/shared-data"

export type ConsoleEvent = {
  id: string
  type: "arrived" | "left" | "delay" | "skip" | "not_running"
  stopId?: string
  delayMin?: number
  reason?: string
  clientAt: string
}
export type ConsoleSession = {
  id: string
  libraryDocumentId: string
  status: "active" | "ended"
  mode: "checkins" | "approximate"
  serviceDate: string
  cycleWeek: number
  day: string
  startedAt: string
  endsAt: string
  endedAt: string | null
  endReason: string | null
  startedByName?: string
  route: Occurrence[]
  state: {
    phase: "before" | "at_stop" | "between" | "ended"
    currentStopId: string | null
    nextStopId: string | null
    delayMin: number
    skipped: { stopId: string; visitId?: string; reason: string }[]
    eventCount?: number
    currentVisitId?: string
    nextVisitId?: string
    currentSince?: string
    arrivals?: { visitId: string; delayMin: number }[]
    averageDelayMin?: number
    completedVisitIds?: string[]
    lastEventAt: string | null
  }
}
export type LiveSettingsResponse = {
  settings: {
    enabled: boolean
    precision: "stops" | "approximate"
    autoStopMinutes: number
    enabledAt: string | null
  }
  library: {
    id: string
    name: string
    timezone: string
    timetable: MobileTimetable | null
  }
  route: Occurrence[]
  activeSession: ConsoleSession | null
  liveEnabled: boolean
}
