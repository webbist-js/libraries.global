import type { FindPlaceLevel } from "@/lib/find-places"

export type ContributionPlace = Partial<Record<FindPlaceLevel, string>>
const levels = ["continent", "country", "region", "area"] as const

export function contributionPlaceParams(
  input: Record<string, unknown>
): ContributionPlace {
  return Object.fromEntries(
    levels.flatMap((level) => {
      const value = input[level]

      return typeof value === "string" &&
        /^[a-z0-9][a-z0-9._-]{0,127}$/i.test(value)
        ? [[level, value]]
        : []
    })
  )
}

export function placeAddHref(
  place: ContributionPlace,
  path = "/contribute/index/new",
  name?: string
): string {
  const params = new URLSearchParams(contributionPlaceParams(place))
  if (name?.trim()) params.set("name", name.trim().slice(0, 200))

  return `${path}${params.size ? `?${params}` : ""}`
}
