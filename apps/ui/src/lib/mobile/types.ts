import type { MobileTimetable, TimetableNotice } from "@repo/shared-data"

export type PublicMobileTimetable = {
  documentId: string
  name: string
  path: string | null
  timezone: string
  status: string | null
  updatedAt: string
  timetable: MobileTimetable | null
  notices: TimetableNotice[]
}
