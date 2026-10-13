import type { ContributionPlace } from "@/lib/contribution-place"
import type { DriveView } from "@/lib/drives/drive-view"

import type {
  ContributionChild,
  ContributionTask,
} from "./place-contribution.logic"
import { PlaceContributionCard } from "./PlaceContributionCard"
import type { PlaceGapInsight } from "./PlaceInsights"

const utcDay = () => Math.floor(Date.now() / 86_400_000)

/** Keep the daily suggestion stable across server rendering and hydration. */
export function PlaceFeaturedContribution({
  level,
  slug,
  name,
  place,
  childPlaces = [],
  siblingPlaces = [],
  childrenAvailable = true,
  childNoun,
  drives = [],
  task,
  gaps,
}: {
  readonly level: "continent" | "country" | "region"
  readonly slug: string
  readonly name: string
  readonly place: ContributionPlace
  readonly childPlaces?: readonly ContributionChild[]
  readonly siblingPlaces?: readonly ContributionChild[]
  readonly childrenAvailable?: boolean
  readonly childNoun?: string
  readonly drives?: readonly { view: DriveView; here: number }[] | null
  readonly gaps?: readonly PlaceGapInsight[] | null
  readonly task?: ContributionTask | null
}) {
  const children =
    childrenAvailable && level !== "region"
      ? [...childPlaces].sort((a, b) => a.name.localeCompare(b.name))
      : []
  const empty = children.filter((child) => child.libraryCount === 0)
  const active = drives?.find(
    (item) => item.here > 0 && item.view.drive.status === "open"
  )
  const selected = !active
    ? empty[level === "continent" ? utcDay() % Math.max(1, empty.length) : 0]
    : undefined
  const drive = active
    ? {
        title: active.view.drive.title.replaceAll("*", ""),
        summary: active.view.drive.summary,
        href: active.view.href,
        endsAt: active.view.drive.endsAt,
        here: active.here,
        gapKeys:
          active.view.drive.focus.kind === "gaps"
            ? active.view.drive.focus.gaps
            : [],
      }
    : undefined

  return (
    <PlaceContributionCard
      key={`${level}:${slug}`}
      name={name}
      level={level}
      place={place}
      childPlaces={children}
      siblings={siblingPlaces}
      initialChildSlug={selected?.slug}
      childNoun={
        childNoun?.toLocaleLowerCase() ??
        (level === "continent" ? "country" : "region")
      }
      gaps={gaps}
      drive={drive}
      task={task}
    />
  )
}
