/**
 * The place levels Find libraries filters by, kept free of the search client
 * so the page's pure helpers can share them.
 */

export type FindPlaceLevel = "continent" | "country" | "region" | "area"

/** Broadest first. */
export const FIND_PLACE_LEVELS: readonly FindPlaceLevel[] = [
  "continent",
  "country",
  "region",
  "area",
]

/** "north-america" → "North America", for a place the index can't name. */
export const nameFromSlug = (slug: string) =>
  slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
