import {
  hasErrors,
  normalizeMobileTimetable,
  timetableHash,
  validateMobileTimetable,
  type MobileTimetable,
} from "@repo/shared-data"

const LIBRARY = "api::library.library"

export class TimetableWriteError extends Error {
  readonly status: number
  constructor(
    readonly code:
      | "invalid_timetable"
      | "stale_timetable"
      | "mobile_only"
      | "mobile_timezone",
    message: string
  ) {
    super(message)
    this.name = "TimetableWriteError"
    this.status = code === "stale_timetable" ? 409 : 400
  }
}
export function validatedTimetable(raw: unknown): MobileTimetable | null {
  if (raw === null || raw === "") return null
  const tt = normalizeMobileTimetable(raw)
  if (!tt)
    throw new TimetableWriteError(
      "invalid_timetable",
      "The timetable format is invalid."
    )
  const issues = validateMobileTimetable(tt)
  if (hasErrors(issues))
    throw new TimetableWriteError(
      "invalid_timetable",
      issues
        .filter((i) => i.level === "error")
        .map((i) => i.message)
        .join(" ")
    )

  return tt
}
export function assertTimetableHash(
  current: unknown,
  previousHash: unknown
): void {
  if (
    typeof previousHash !== "string" ||
    previousHash !== timetableHash(normalizeMobileTimetable(current))
  )
    throw new TimetableWriteError(
      "stale_timetable",
      "The timetable changed after this was suggested. Reload it before making another change."
    )
}
export async function prepareMobileLibraryData(
  strapi: any,
  data: Record<string, unknown>,
  current: Record<string, any> | null,
  locale: string
): Promise<Record<string, unknown>> {
  const next = { ...data },
    type = data.libraryType ?? current?.libraryType
  if (Object.prototype.hasOwnProperty.call(data, "mobileTimetable")) {
    if (type !== "Mobile" && data.mobileTimetable != null)
      throw new TimetableWriteError(
        "mobile_only",
        "Only a Mobile library can have a mobile timetable."
      )
    next.mobileTimetable = validatedTimetable(data.mobileTimetable)
  }
  if (type !== "Mobile") return next
  let location = data.location ?? current?.location
  const relation = data.homeLibrary as
    | { set?: { documentId?: string }[]; connect?: { documentId?: string }[] }
    | string
    | null
    | undefined
  const homeId =
    typeof relation === "string"
      ? relation
      : (relation?.set?.[0]?.documentId ??
        relation?.connect?.[0]?.documentId ??
        (relation === undefined ? current?.homeLibrary?.documentId : null))
  if (homeId) {
    const home = await strapi.documents(LIBRARY).findOne({
      documentId: homeId,
      locale,
      status: "published",
      fields: [
        "libraryType",
        "location",
        "streetAddress",
        "city",
        "postalCode",
        "timezone",
      ],
    })
    if (
      !home ||
      home.libraryType === "Mobile" ||
      homeId === current?.documentId
    )
      throw new TimetableWriteError(
        "invalid_timetable",
        "Choose a published branch as the home base."
      )
    if (data.homeLibrary !== undefined) {
      for (const field of ["location", "streetAddress", "city", "postalCode"])
        next[field] = home[field] ?? null
      location = home.location
    }
    if (!data.timezone && !current?.timezone && home.timezone)
      next.timezone = home.timezone
  }
  const timetable = normalizeMobileTimetable(
    next.mobileTimetable ?? current?.mobileTimetable
  )
  if (!location && timetable) {
    location = timetable.stops.find((s) => s.location)?.location
    if (location) {
      next.location = location
      for (const field of ["streetAddress", "city", "postalCode"])
        next[field] = null
    }
  }
  if (!next.timezone && !current?.timezone) {
    if (
      !location ||
      typeof (location as any).lat !== "number" ||
      typeof (location as any).lng !== "number"
    )
      throw new TimetableWriteError(
        "mobile_timezone",
        "Add the home base location so the library's timezone can be set."
      )
    const { default: lookup } = await import("tz-lookup")
    next.timezone = lookup((location as any).lat, (location as any).lng)
  }

  return next
}
