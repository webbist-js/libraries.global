import type { MobileTimetable, TimetableNotice } from "@repo/shared-data"

export type MobileRoadRoute = {
  stopIds: string[]
  geometry: GeoJSON.LineString
}

export type PublicMobileTimetable = {
  documentId: string
  name: string
  path: string | null
  timezone: string
  status: string | null
  updatedAt: string
  timetable: MobileTimetable | null
  notices: TimetableNotice[]
  /** Atlas road geometry loaded separately from the public timetable. */
  roadRoutes?: MobileRoadRoute[]
  routesUnavailable?: boolean
}
