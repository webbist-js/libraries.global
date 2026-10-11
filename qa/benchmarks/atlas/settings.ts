import {
  ATLAS_LIMITS,
  ATLAS_OPEN_DAYS,
  ATLAS_OPEN_FRAMES_PER_DAY,
  atlasOpenField,
} from "@repo/shared-data"

export const atlasSettings = {
  searchableAttributes: ["name", "city", "region_name", "country_name"],
  displayedAttributes: ["*"],
  filterableAttributes: [
    "atlas_id",
    "documentId",
    "locale",
    "listed",
    "type_group",
    "operator_group",
    "facility_codes",
    "access_codes",
    "has_access",
    "has_events",
    "has_catalogue",
    "founded",
    "late_sunday",
    "open_tz",
    "closed_dates",
    "clock_valid_until",
    "latitude",
    "longitude",
    "_geo",
    "continent_id",
    "country_id",
    "region_id",
    "area_id",
    "city_key",
    "name_sort",
    "place_sort",
    "completeness",
    ...Array.from(
      { length: ATLAS_LIMITS.maxCellZoom + 1 },
      (_, z) => `atlas_cell_${z}`
    ),
    ...["open", "regular_open", "staff_open"].flatMap((prefix) =>
      ATLAS_OPEN_DAYS.flatMap((day) =>
        Array.from({ length: ATLAS_OPEN_FRAMES_PER_DAY }, (_, n) => [
          atlasOpenField(
            day,
            n,
            "from",
            prefix as "open" | "regular_open" | "staff_open"
          ),
          atlasOpenField(
            day,
            n,
            "to",
            prefix as "open" | "regular_open" | "staff_open"
          ),
        ]).flat()
      )
    ),
  ],
  sortableAttributes: [
    "founded",
    "atlas_id",
    "name_sort",
    "place_sort",
    "_geo",
    "latitude",
    "longitude",
  ],
  pagination: { maxTotalHits: ATLAS_LIMITS.points },
  faceting: { maxValuesPerFacet: ATLAS_LIMITS.facetValues },
}
