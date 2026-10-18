/** Scheduled mobile services are represented by stop pins, rather than a depot. */
export const BUILDING_LIBRARY_FILTER = {
  $or: [
    { libraryType: { name: { $ne: "Mobile" } } },
    { mobileTimetable: { $null: true } },
  ],
}
