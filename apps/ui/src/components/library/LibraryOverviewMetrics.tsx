import { libraryTypeName } from "@repo/shared-data"

import {
  RecordMetrics,
  type RecordMetric,
} from "@/components/dashboard/RecordMetrics"
import { facilityRows } from "@/components/library/facility-rows"
import {
  DAY_ORDER,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import { libraryChecklist } from "@/components/library/library-presentation"
import { summariseWeek } from "@/components/location/location-page.helpers"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

/** Summaries reflect the record, including confirmed No answers and missing data. */
export function LibraryOverviewMetrics({
  library,
}: {
  readonly library: PopulatedLibraryData
}) {
  const rec = library as unknown as Record<string, unknown>
  const type = libraryTypeName(library.libraryType)
  const hours = library.openingTimes as OpeningTimesValue | null
  const access = facilityRows(library).filter(
    (row) => row.category !== "service"
  )
  const answered = access.filter((row) => row.state !== "unknown").length
  const checklist = libraryChecklist(library)
  const collections = Array.isArray(rec.collectionStats)
    ? rec.collectionStats.find((item: { value?: string }) => item?.value)
    : undefined
  const items: RecordMetric[] = [
    ...(type !== "Mobile" && type !== "Digital"
      ? [
          {
            label: "Opening hours",
            value: hours?.days?.length
              ? `${hours.days.filter((day) => day.enabled && day.timeframes?.length).length} days`
              : "Not recorded",
            note: summariseWeek(hours) ?? "Help add the regular schedule",
            href: "#hours",
            segments: DAY_ORDER.map((key) =>
              Boolean(
                hours?.days?.find(
                  (day) =>
                    day.day === key && day.enabled && day.timeframes?.length
                )
              )
            ),
          },
        ]
      : []),
    ...(access.length
      ? [
          {
            label: "Accessibility",
            value: `${answered} of ${access.length}`,
            note: `${access.length - answered} questions open`,
            href: "#access",
            segments: access.map((row) => row.state !== "unknown"),
          },
        ]
      : []),
    {
      label: "Core details",
      value: `${checklist.done} of ${checklist.total}`,
      note: "Recorded details · see sources and checks",
      href: "#changes",
      segments: checklist.items.map((item) => item.done),
    },
    ...(collections
      ? [
          {
            label: "Collections",
            value: String(collections.value),
            note:
              typeof collections.category === "string"
                ? collections.category
                : "Recorded collection figures",
            href: "#about",
          },
        ]
      : [
          {
            label: "Help improve this record",
            value: `${checklist.total - checklist.done} gaps`,
            note: "Add what you know, with a source",
            href: "#contribute",
          },
        ]),
  ]

  return <RecordMetrics items={items} />
}
