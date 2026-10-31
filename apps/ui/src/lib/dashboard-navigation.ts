import { SUPPORTED_LOCALES } from "@repo/shared-data"

const continents = new Set([
  "africa",
  "antarctica",
  "asia",
  "europe",
  "north-america",
  "oceania",
  "south-america",
])

function parts(path: string) {
  const segments = path.split(/[?#]/)[0]!.split("/").filter(Boolean)
  if (
    SUPPORTED_LOCALES.includes(
      segments[0] as (typeof SUPPORTED_LOCALES)[number]
    )
  )
    segments.shift()

  return segments
}

export type DashboardDirection =
  | "atlas-forward"
  | "atlas-back"
  | "nav-forward"
  | "nav-back"
  | "section-forward"
  | "section-back"

function ancestor(parent: readonly string[], child: readonly string[]) {
  return (
    parent.length < child.length && parent.every((part, i) => part === child[i])
  )
}

function orderedDirection(
  source: string[],
  target: string[],
  paths: readonly string[]
): DashboardDirection | null {
  const destinations = paths.map(parts)
  const indexOf = (route: string[]) =>
    destinations.reduce(
      (best, destination, index) =>
        destination.length &&
        destination.every((part, i) => part === route[i]) &&
        (best < 0 || destination.length > destinations[best]!.length)
          ? index
          : best,
      -1
    )
  const fromIndex = indexOf(source),
    toIndex = indexOf(target)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null

  return toIndex > fromIndex ? "section-forward" : "section-back"
}

function geographicDirection(
  source: string[],
  target: string[]
): DashboardDirection | null {
  const sourcePlace = continents.has(source[0]!),
    targetPlace = continents.has(target[0]!)
  if (source[0] === "map" && targetPlace) return "atlas-forward"
  if (sourcePlace && target[0] === "map") return "atlas-back"
  if (source[0] === "libraries" && targetPlace) return "nav-forward"
  if (sourcePlace && target[0] === "libraries") return "nav-back"
  if (sourcePlace && targetPlace)
    return ancestor(target, source) ? "nav-back" : "nav-forward"

  return null
}

/** Geography expresses depth; workspace destinations follow their visible order. */
export function dashboardDirection(
  from: string,
  to: string,
  orderedDestinations: readonly string[] = []
): DashboardDirection | null {
  if (!to.startsWith("/") || to.startsWith("//")) return null
  const source = parts(from),
    target = parts(to)
  if (source.join("/") === target.join("/")) return null
  if (!source.length || !target.length) return null
  const geographic = geographicDirection(source, target)
  if (geographic) return geographic

  const ordered = orderedDirection(source, target, orderedDestinations)
  if (ordered) return ordered
  if (source[0] === target[0])
    return ancestor(target, source) ? "section-back" : "section-forward"

  return null
}
