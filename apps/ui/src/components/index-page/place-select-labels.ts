import {
  lowerFirst,
  placeLabels,
} from "@/components/location/location-page.helpers"
import type { FindLocation } from "@/lib/find-search"

import type { PlaceLevel } from "./find-helpers"

/** The Location selects' labels; the Region one in the chosen country's words. */
export function placeSelectLabels(
  location?: FindLocation
): { level: PlaceLevel; label: string; all: string }[] {
  const region = placeLabels(location?.country).region

  return [
    { level: "continent", label: "Continent", all: "All continents" },
    { level: "country", label: "Country", all: "All countries" },
    {
      level: "region",
      label: region.name,
      all: `All ${lowerFirst(region.plural)}`,
    },
  ]
}
