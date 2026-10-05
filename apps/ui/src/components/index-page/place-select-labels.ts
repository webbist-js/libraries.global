import {
  lowerFirst,
  placeLabels,
} from "@/components/location/location-page.helpers"
import type { FindLocation } from "@/lib/find-search"

import type { PlaceLevel } from "./find-helpers"

/**
 * The Location selects' labels; the Region and Area ones in the chosen
 * country's words (a Region naming its own Areas wins for the Area one).
 */
export function placeSelectLabels(
  location?: FindLocation
): { level: PlaceLevel; label: string; all: string }[] {
  const { region, area } = placeLabels(location?.country, location?.region)

  return [
    { level: "continent", label: "Continent", all: "All continents" },
    { level: "country", label: "Country", all: "All countries" },
    {
      level: "region",
      label: region.name,
      all: `All ${lowerFirst(region.plural)}`,
    },
    {
      level: "area",
      label: area.name,
      all: `All ${lowerFirst(area.plural)}`,
    },
  ]
}
