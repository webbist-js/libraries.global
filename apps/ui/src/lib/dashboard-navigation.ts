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

/** Direction describes ancestry, never the order in which sibling links appear. */
export function dashboardDirection(
  from: string,
  to: string
): "nav-forward" | "nav-back" | null {
  const source = parts(from),
    target = parts(to)
  if (source.join("/") === target.join("/")) return null
  if (!source.length || !target.length) return null
  const sourcePlace = continents.has(source[0]!),
    targetPlace = continents.has(target[0]!)
  if (["map", "libraries"].includes(source[0]!) && targetPlace)
    return "nav-forward"
  if (sourcePlace && ["map", "libraries"].includes(target[0]!))
    return "nav-back"
  const related =
    (sourcePlace && targetPlace) ||
    ([
      "library-networks",
      "journal",
      "knowledge",
      "developers",
      "staff",
      "contribute",
      "moderation",
      "legal",
      "profile",
    ].includes(source[0]!) &&
      source[0] === target[0])
  if (!related) return null
  if (
    source.length < target.length &&
    source.every((part, i) => part === target[i])
  )
    return "nav-forward"
  if (
    target.length < source.length &&
    target.every((part, i) => part === source[i])
  )
    return "nav-back"

  return null
}
