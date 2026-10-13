import {
  WEEKDAYS,
  type MobileTimetable,
  type MobileVisit,
  type VisitRepeat,
  type Weekday,
} from "./types"

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

export type MobileFrequency = "weekly" | "fortnightly" | "monthly"

/** All recurrence frequencies represented at a stop, independent of its weekdays. */
export function stopFrequencies(
  visits: MobileVisit[],
  cycle: MobileTimetable["cycle"]
): MobileFrequency[] {
  const frequencies = new Set<MobileFrequency>()
  for (const visit of visits) {
    if (visit.repeat.kind === "monthly") frequencies.add("monthly")
    if (visit.repeat.kind !== "cycle") continue
    const weeks = [...new Set(visit.repeat.weeks)].sort((a, b) => a - b)
    if (weeks.length === cycle.weeks) frequencies.add("weekly")
    else if (
      weeks.length > 0 &&
      cycle.weeks === weeks.length * 2 &&
      weeks.every(
        (week, i) => (weeks[i + 1] ?? weeks[0]! + cycle.weeks) - week === 2
      )
    )
      frequencies.add("fortnightly")
  }

  return [...frequencies]
}

/** "1, 2 and 3": commas between, "and" before the last. */
function listWeeks(weeks: number[]): string {
  if (weeks.length <= 1) return weeks.join("")

  return `${weeks.slice(0, -1).join(", ")} and ${weeks.at(-1)}`
}

export function describeRepeat(
  visit: MobileVisit,
  cycle: MobileTimetable["cycle"]
): string {
  let label: string
  if (visit.repeat.kind === "cycle") {
    if (visit.repeat.weeks.length === cycle.weeks) label = "Every week"
    else if (visit.repeat.weeks.length === 1)
      label = `Every ${cycle.weeks} weeks · Week ${visit.repeat.weeks[0]}`
    else label = `Weeks ${listWeeks(visit.repeat.weeks)} of ${cycle.weeks}`
  } else if (visit.repeat.kind === "monthly")
    label = `${visit.repeat.nth === -1 ? "Last" : ["", "1st", "2nd", "3rd", "4th"][visit.repeat.nth]} ${DAYS[WEEKDAYS.indexOf(visit.day)]} of the month`
  else
    label = `${visit.repeat.dates.length} specific ${visit.repeat.dates.length === 1 ? "date" : "dates"}`

  return label + (visit.termTimeOnly ? " · term time only" : "")
}
export function repeatOptions(
  cycle: MobileTimetable["cycle"],
  day: Weekday
): { value: string; label: string; repeat: VisitRepeat }[] {
  const options: { value: string; label: string; repeat: VisitRepeat }[] = [
    {
      value: "every",
      label: "Every week",
      repeat: {
        kind: "cycle",
        weeks: Array.from({ length: cycle.weeks }, (_, i) => i + 1),
      },
    },
  ]
  if (cycle.weeks > 1)
    for (let w = 1; w <= cycle.weeks; w++)
      options.push({
        value: `week-${w}`,
        label: `Every ${cycle.weeks} weeks · Week ${w}`,
        repeat: { kind: "cycle", weeks: [w] },
      })
  if (cycle.weeks === 4) {
    options.push(
      {
        value: "weeks-1-3",
        label: "Weeks 1 and 3 of 4",
        repeat: { kind: "cycle", weeks: [1, 3] },
      },
      {
        value: "weeks-2-4",
        label: "Weeks 2 and 4 of 4",
        repeat: { kind: "cycle", weeks: [2, 4] },
      }
    )
  }
  for (const nth of [1, 2, 3, 4, -1] as const) {
    const repeat: VisitRepeat = { kind: "monthly", nth }
    options.push({
      value: `monthly-${nth}`,
      repeat,
      label: describeRepeat(
        { day, repeat, termTimeOnly: false } as MobileVisit,
        cycle
      ),
    })
  }
  options.push({
    value: "dates",
    label: "Specific dates",
    repeat: { kind: "dates", dates: [] },
  })

  return options
}
