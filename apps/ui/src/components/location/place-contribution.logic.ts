import { type ContributionPlace, placeAddHref } from "@/lib/contribution-place"

import type { PlaceGapInsight } from "./PlaceInsights"

export type ContributionChild = {
  slug: string
  name: string
  libraryCount?: number
}
export type PlaceContributionDrive = {
  title: string
  summary: string
  href: string
  endsAt: string
  here: number
  gapKeys: string[]
}
export type ContributionTask = {
  gapKey?: string
  title: string
  description: string
  href: string
  label: string
}

export const GAP_TASKS: Record<
  string,
  {
    title: string
    benefit: string
    find: string
    need: string
    icon: string
    tint: string
  }
> = {
  hours: {
    title: "Add opening hours",
    benefit: "Help someone plan a visit.",
    find: "Find libraries missing hours",
    need: "missing hours",
    icon: "mdi:clock-outline",
    tint: "indigo",
  },
  accessibility: {
    title: "Answer an accessibility question",
    benefit: "One answer can help someone decide whether to visit.",
    find: "Find libraries with access questions",
    need: "with an open accessibility question",
    icon: "mdi:human",
    tint: "green",
  },
  photo: {
    title: "Share a photo",
    benefit: "Show visitors what to expect.",
    find: "Find libraries without a photo",
    need: "without a photo",
    icon: "mdi:camera-outline",
    tint: "rust",
  },
  contact: {
    title: "Add contact details",
    benefit: "Help someone get in touch with a library.",
    find: "Find libraries missing contact details",
    need: "missing contact details",
    icon: "mdi:link-variant",
    tint: "indigo",
  },
  address: {
    title: "Add an address",
    benefit: "Help someone find their way to a library.",
    find: "Find libraries missing an address",
    need: "missing an address",
    icon: "mdi:map-marker-outline",
    tint: "green",
  },
  services: {
    title: "Add service details",
    benefit: "Help visitors find the services they need.",
    find: "Find libraries missing service details",
    need: "missing service details",
    icon: "mdi:book-open-outline",
    tint: "green",
  },
}

/** Type groups are disjoint; sum each gap once across the applicable types. */
export function aggregateContributionGaps(
  rows: readonly PlaceGapInsight[] | null | undefined
) {
  const totals = new Map<
    string,
    { key: string; missing: number; eligible: number }
  >()
  for (const row of rows ?? []) {
    const total = totals.get(row.key) ?? {
      key: row.key,
      missing: 0,
      eligible: 0,
    }
    total.missing += row.missing
    total.eligible += row.eligible
    totals.set(row.key, total)
  }

  return [...totals.values()].sort((a, b) => b.missing - a.missing)
}

export function gapLibrariesHref(place: ContributionPlace, key: string) {
  return `/libraries?${new URLSearchParams({ ...place, needs: key })}`
}

type FeaturedPlaceInput = {
  name: string
  place: ContributionPlace
  child?: ContributionChild
  childLevel: "country" | "region" | "area"
  drive?: PlaceContributionDrive
  gaps: ReturnType<typeof aggregateContributionGaps>
  task?: ContributionTask | null
}

function driveTask(
  { name, place, child, childLevel }: FeaturedPlaceInput,
  drive: PlaceContributionDrive
) {
  const date = new Date(drive.endsAt)
  const deadline = Number.isNaN(date.getTime())
    ? ""
    : ` · until ${date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}`

  const targetPlace = child ? { ...place, [childLevel]: child.slug } : place
  const targetName = child?.name ?? name
  const params = new URLSearchParams(targetPlace)

  return {
    kind: "drive" as const,
    eyebrow: `Community drive${deadline}`,
    title: child ? `${drive.title} in ${child.name}` : drive.title,
    description: drive.summary,
    label: child
      ? `Help with this drive in ${child.name}`
      : "Help with this drive",
    href: `${drive.href}?${params}`,
    context: child
      ? `Opens this drive’s tasks in ${targetName}. Pick a library, then add what you know.`
      : `Opens this drive’s tasks. ${drive.here.toLocaleString("en-GB")} ${drive.here === 1 ? "library needs" : "libraries need"} help in ${name}.`,
    gapKeys: drive.gapKeys,
  }
}

function childTask(
  { place, childLevel }: FeaturedPlaceInput,
  child: ContributionChild
) {
  return {
    kind: "add" as const,
    eyebrow: "Help build the index",
    title: `Put a library in ${child.name} on the map.`,
    description:
      child.libraryCount === 0
        ? `We haven’t documented any libraries in ${child.name} yet. Know one? Help people find it by starting a record.`
        : `Know a library in ${child.name} that’s missing from the index? Help people find it by starting a record.`,
    label: `Add a library in ${child.name}`,
    href: placeAddHref({ ...place, [childLevel]: child.slug }),
    context: `${child.name} is already selected. Your draft saves as you go.`,
    gapKeys: [] as string[],
  }
}

function gapTask(
  { name, place }: FeaturedPlaceInput,
  gap: { key: string; missing: number }
) {
  const copy = GAP_TASKS[gap.key]!
  const count = gap.missing.toLocaleString("en-GB")

  return {
    kind: "gap" as const,
    eyebrow: "Help keep records useful",
    title:
      gap.key === "hours"
        ? `Help people plan a visit to a library in ${name}.`
        : `${copy.title} for libraries in ${name}.`,
    description:
      gap.key === "hours"
        ? `${count} ${gap.missing === 1 ? "library in" : "libraries in"} ${name} ${gap.missing === 1 ? "doesn’t list" : "don’t list"} opening hours yet. If you know one, add its times with a current source.`
        : `${count} ${gap.missing === 1 ? "library in" : "libraries in"} ${name} ${gap.missing === 1 ? "needs" : "need"} this detail. Choose one you know and help fill the gap.`,
    label: copy.find,
    href: gapLibrariesHref(place, gap.key),
    context: `Opens libraries in ${name} ${copy.need}. Pick one, then add what you know.`,
    gapKeys: [gap.key],
  }
}

function fallbackTask({ name, place, task }: FeaturedPlaceInput) {
  return {
    kind: task ? ("task" as const) : ("add" as const),
    eyebrow: task ? "Help keep records useful" : "Help build the index",
    title: task?.title ?? `Put a library in ${name} on the map.`,
    description:
      task?.description ??
      `Know a library in ${name} that’s missing from the index? Help people find it by starting a record.`,
    label: task?.label ?? `Add a library in ${name}`,
    href: task?.href ?? placeAddHref(place),
    context: task
      ? "Choose a library you know and add a source."
      : `${name} is already selected. Your draft saves as you go.`,
    gapKeys: task?.gapKey
      ? [task.gapKey]
      : task?.href.includes("needs=")
        ? [
            new URL(task.href, "https://libraries.global").searchParams.get(
              "needs"
            ) ?? "",
          ]
        : [],
  }
}

export function featuredPlaceTask(input: FeaturedPlaceInput) {
  if (input.drive) return driveTask(input, input.drive)
  if (input.child) return childTask(input, input.child)
  const gap = input.gaps.find((row) => row.missing > 0 && GAP_TASKS[row.key])

  return gap ? gapTask(input, gap) : fallbackTask(input)
}

export function contributionRequirement(kind: string, gap?: string): string {
  if (kind === "add")
    return "For a new record, you’ll need the library’s name, type, operational status, town or city, country, and a supporting source. Other sections can be skipped. For a mobile library, add its base region instead of a town or city. Your draft saves as you go."
  if (kind === "drive")
    return "Choose a task in the drive and follow its guidance. Add only details you can support with a source. For a photo, use your own or one you may share under the contribution licence."
  if (gap === "photo")
    return "Choose a library, then share a photo you took or may publish under the contribution licence. Include its credit and source."
  if (gap === "accessibility")
    return "Choose a library and answer a question you know, with a source or details of your visit. An explicit No is useful too; leave anything you don’t know unanswered."

  return "Choose a library and add the detail you know with a current source, such as the library’s own website. Leave other details as they are."
}
