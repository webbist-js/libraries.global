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

/** Keep the owning draft in the sign-in return URL. */
export function withLibraryDraft(
  href: string,
  params: { draft?: string; resume?: string }
): string {
  const [path, query] = href.split("?")
  const search = new URLSearchParams(query)
  if (params.draft === "contribute") search.set("draft", "contribute")
  if (params.resume) search.set("resume", params.resume)

  return `${path}${search.size ? `?${search}` : ""}`
}
