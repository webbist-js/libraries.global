import {
  formatCount,
  joinList,
} from "@/components/location/location-page.helpers"

export function placeSummary({
  name,
  total,
  children,
  noun,
  available = true,
  childrenAvailable = true,
}: {
  name: string
  total: number
  children: readonly { name: string; libraryCount?: number }[]
  noun: { singular: string; plural: string }
  available?: boolean
  childrenAvailable?: boolean
}) {
  if (!available)
    return (
      "Explore documented libraries in " +
      name +
      ". Statistics are temporarily unavailable."
    )
  if (!total)
    return (
      "No libraries in " +
      name +
      " are documented yet. Know one? Its name, place and a reliable source can start the index here."
    )
  const ranked = [...children]
    .filter((child) => (child.libraryCount ?? 0) > 0)
    .sort((a, b) => (b.libraryCount ?? 0) - (a.libraryCount ?? 0))
  const leading = ranked.slice(0, 3)
  const empty = children.filter((child) => child.libraryCount === 0).length

  return (
    "The index documents " +
    formatCount(total) +
    " " +
    (total === 1 ? "library" : "libraries") +
    " in " +
    name +
    (childrenAvailable && leading.length
      ? ", with the most records in " +
        joinList(leading.map((child) => child.name))
      : "") +
    ". " +
    (total >= 10
      ? "That reflects where contributors have been active so far. "
      : "Each new record makes this picture more useful. ") +
    (childrenAvailable && empty
      ? formatCount(empty) +
        " " +
        (empty === 1
          ? noun.singular + " awaits its"
          : noun.plural + " await their") +
        " first record."
      : "")
  )
}
