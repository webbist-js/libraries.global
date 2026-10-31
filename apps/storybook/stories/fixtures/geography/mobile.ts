import { EMPTY_FORM } from "@/components/library-editor/wizard.types"
import type { SessionLog } from "@/components/mobile/live/LiveSessionsTable"
import type { LiveSettingsResponse } from "@/lib/mobile-live/types"
import type { MobileStopHit } from "@/lib/mobile-stop-search"
import {
  dayRoute,
  WEEKDAYS,
  type MobileTimetable,
  type PublicLiveState,
} from "@repo/shared-data"

export const timetable: MobileTimetable = {
  version: 1,
  cycle: { weeks: 1, anchor: "2026-01-12" },
  stops: [
    {
      id: "example-market",
      name: "Market Square",
      where: "Beside the community hall",
      location: { lat: 51.5, lng: -0.1 },
      areaDocumentId: null,
    },
    {
      id: "example-garden",
      name: "Garden Village",
      where: "The accessible village car park",
      location: { lat: 51.53, lng: -0.06 },
      areaDocumentId: null,
    },
  ],
  visits: WEEKDAYS.flatMap((day) => [
    {
      id: `${day}-market`,
      stopId: "example-market",
      day,
      arrive: "09:30",
      depart: "10:15",
      repeat: { kind: "cycle" as const, weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
    {
      id: `${day}-garden`,
      stopId: "example-garden",
      day,
      arrive: "11:00",
      depart: "11:45",
      repeat: { kind: "cycle" as const, weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
  ]),
}
export const route = dayRoute(timetable, [], "2026-01-15")
export const liveSettings: LiveSettingsResponse = {
  settings: {
    enabled: true,
    precision: "stops",
    autoStopMinutes: 60,
    enabledAt: "2026-01-15T08:00:00Z",
  },
  library: {
    id: "example-mobile",
    name: "Northbridge Mobile Library",
    timezone: "Europe/London",
    timetable,
  },
  route,
  activeSession: null,
  liveEnabled: true,
}
export const publicLive: PublicLiveState = {
  libraryDocumentId: "example-mobile",
  kind: "here",
  sharesLive: true,
  stopId: "example-market",
  nextStopId: "example-garden",
  until: "2026-01-15T10:15:00Z",
  scheduledAt: "2026-01-15T09:30:00Z",
  expectedAt: null,
  delayMin: 0,
  noticeMessage: null,
  nextService: {
    date: "2026-01-16",
    stopId: "example-market",
    arrive: "09:30",
  },
  position: null,
  skippedStopIds: [],
  updatedAt: "2026-01-15T09:35:00Z",
}
export const stopHit: MobileStopHit = {
  id: "example-mobile-market",
  stop_id: "example-market",
  name: "Market Square",
  where: "Beside the community hall",
  library_name: "Northbridge Mobile Library",
  library_slug: "northbridge-mobile",
  library_path: "/europe/example-country/northbridge/northbridge-mobile",
  library_document_id: "example-mobile",
  area_slug: null,
  region_slug: "northbridge",
  country_slug: "example-country",
  _geo: { lat: 51.5, lng: -0.1 },
  visit_keys: [],
  cancelled_dates: [],
  cycle: timetable.cycle,
  visits: timetable.visits.filter((visit) => visit.stopId === "example-market"),
  shares_live: false,
  timezone: "Europe/London",
}
export const sessionLogs: SessionLog[] = [
  {
    id: "example-session",
    libraryDocumentId: "example-mobile",
    status: "ended",
    mode: "checkins",
    serviceDate: "2026-01-15",
    cycleWeek: 1,
    day: "thu",
    startedAt: "2026-01-15T09:00:00Z",
    endsAt: "2026-01-15T12:00:00Z",
    endedAt: "2026-01-15T11:45:00Z",
    endReason: "manual",
    route,
    startedByName: "Example crew member",
    state: {
      phase: "ended",
      currentStopId: null,
      nextStopId: null,
      delayMin: 0,
      skipped: [],
      lastEventAt: "2026-01-15T11:45:00Z",
    },
    checkIns: 2,
    totalStops: 2,
    flags: [],
  },
]
export const wizardForm = {
  ...EMPTY_FORM,
  name: "Northbridge Community Library",
  shortName: "Northbridge Library",
  libraryType: "Public",
  operationalStatus: "open",
  city: "Northbridge",
  country: "Example country",
  streetAddress: "1 Example Square",
  lat: "51.5",
  lng: "-0.1",
  summary: "A welcoming community library with accessible reading rooms.",
  website: "https://example.invalid/library",
  mobileTimetable: timetable,
}
