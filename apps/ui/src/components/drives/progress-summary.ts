import type { DriveProgressLogEntry } from "@/lib/drives/types"

/** Published change since Monday UTC; omit it without a trustworthy starting tally. */
export function publishedThisWeek(
  log: readonly DriveProgressLogEntry[] | null | undefined,
  done: number,
  now = new Date()
): number | null {
  const monday =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
    ((now.getUTCDay() + 6) % 7) * 86_400_000
  const before = (log ?? [])
    .filter((entry) => Date.parse(entry.day) < monday)
    .sort((a, b) => Date.parse(b.day) - Date.parse(a.day))[0]
  // A missing week of snapshots mustn't be presented as this week's change.
  if (!before || Date.parse(before.day) < monday - 86_400_000) return null

  return done - before.done
}

/** Add display breaks to the familiar drive title pattern without changing CMS content. */
export function driveHeroTitle(title: string): string {
  if (title.includes("\n")) return title
  const index = title.toLowerCase().indexOf(" for every ")
  if (index < 1) return title
  const tail = title.slice(index + " for every ".length).trim()
  if (!tail) return title

  return `${title.slice(0, index).trim()}\nfor every\n${tail.includes("*") ? tail : `*${tail}*`}`
}
