import type {
  AtlasAccessMetric,
  AtlasBounds,
  AtlasLibraryAccessArea,
  AtlasLibraryAccessResponse,
} from "@repo/shared-data"

export const ACCESS_COMPARE_PREVIEW_SIZE = 12
export const ACCESS_COMPARE_PAGE_SIZE = 25

export function libraryAccessCsv(
  response: AtlasLibraryAccessResponse,
  analysis?: { kind: "view" | "all"; bounds?: AtlasBounds }
): string {
  const quote = (value: string | number | null) => {
    const text = value === null ? "" : String(value)

    return `"${(/^\s*[=+\-@]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`
  }

  return [
    [
      "Area",
      "Reporting code",
      "Level",
      "Country",
      "Matching libraries",
      "Indexed baseline",
      "Residents",
      "Population year",
      "Libraries per 100000 people",
      "People per library",
      "Data state",
      "Population source",
      "Population URL",
      "Licence",
      "Population retrieved at",
      "Boundary source",
      "Boundary URL",
      "Boundary version",
      "Population version",
      "Index revision",
      "Evaluated at",
      "Filters",
      "Unjoined matching libraries",
      "Geographic coverage",
      "Caveat",
      "Analysis scope",
      "Map view bounds",
    ],
    ...response.areas.map((area) => [
      area.name,
      area.id,
      area.level,
      area.country,
      area.libraryCount,
      area.indexedCount,
      area.population,
      area.populationYear,
      area.per100k,
      area.peoplePerLibrary,
      area.status,
      area.populationSource,
      area.populationSourceUrl,
      area.populationLicence,
      area.populationRetrievedAt,
      response.baseline.boundarySource,
      response.baseline.boundaryUrl,
      response.baseline.version,
      response.baseline.populationVersion ?? "",
      response.indexedThrough,
      response.evaluatedAt,
      JSON.stringify(response.scope),
      response.unmappedLibraries,
      response.coverage.note,
      "Incomplete library index; not travel access, capacity or quality. Mobile services counted once at their mapped depot.",
      analysis?.kind === "view" && analysis.bounds
        ? "Whole areas intersecting map view"
        : "All comparison areas",
      analysis?.kind === "view" && analysis.bounds
        ? JSON.stringify(analysis.bounds)
        : "",
    ]),
  ]
    .map((row) => row.map(quote).join(","))
    .join("\r\n")
}

export function accessValue(
  area: AtlasLibraryAccessArea,
  metric: AtlasAccessMetric
): string {
  if (area.status !== "available") return "No data"
  if (metric === "peoplePerLibrary" && area.libraryCount === 0)
    return "No matching libraries"
  const value = metric === "per100k" ? area.per100k : area.peoplePerLibrary
  if (value === null) return "No data"
  if (metric === "per100k" && value > 0 && value < 0.01) return "<0.01"

  return value.toLocaleString(undefined, {
    maximumFractionDigits: metric === "per100k" ? 2 : 0,
  })
}

/** Bounds choose which complete units to inspect; they never clip a rate. */
export function accessAreaInView(
  area: AtlasLibraryAccessArea,
  view: AtlasBounds
): boolean {
  const bounds = area.bounds
  if (!bounds || bounds.south > view.north || bounds.north < view.south)
    return false
  const east = bounds.east < bounds.west ? bounds.east + 360 : bounds.east
  const viewEast = view.east < view.west ? view.east + 360 : view.east

  return [-360, 0, 360].some(
    (shift) => bounds.west + shift <= viewEast && east + shift >= view.west
  )
}

export type AreaSort = "rate" | "name" | "libraries"
export type SortDirection = "asc" | "desc"

/** Unknown rates stay last; an available filtered zero has an unbounded inverse. */
export function sortAccessAreas(
  areas: readonly AtlasLibraryAccessArea[],
  metric: AtlasAccessMetric,
  sort: AreaSort,
  direction: SortDirection
): AtlasLibraryAccessArea[] {
  const value = (area: AtlasLibraryAccessArea) =>
    area.status !== "available"
      ? null
      : metric === "per100k"
        ? area.per100k
        : area.libraryCount === 0
          ? Infinity
          : area.peoplePerLibrary

  return [...areas].sort((a, b) => {
    if (sort === "name")
      return (direction === "asc" ? 1 : -1) * a.name.localeCompare(b.name)
    const left = sort === "libraries" ? a.libraryCount : value(a),
      right = sort === "libraries" ? b.libraryCount : value(b)
    if (left === null || right === null)
      return left === right
        ? a.name.localeCompare(b.name)
        : left === null
          ? 1
          : -1
    const comparison = left === right ? 0 : left < right ? -1 : 1

    return (
      (direction === "asc" ? comparison : -comparison) ||
      a.name.localeCompare(b.name)
    )
  })
}

export type ProvisionDirection =
  | "provisionLow"
  | "provisionHigh"
  | SortDirection
