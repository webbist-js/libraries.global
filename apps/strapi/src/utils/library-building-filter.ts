/** Scheduled mobile services are represented by stop pins, rather than a depot. */
export const BUILDING_LIBRARY_FILTER = {
  $or: [
    { libraryType: { $ne: "Mobile" } },
    { mobileTimetable: { $null: true } },
  ],
}

export const BUILDING_LIBRARY_SQL =
  "(l.library_type <> ? OR l.mobile_timetable IS NULL)"
