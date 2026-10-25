import type { IconName } from "./atlas-ui"
import type { LayerId } from "./atlas.logic"

export type AtlasAnalysisMode =
  | "libraryAccess"
  | "accessibility"
  | "population"
  | "reach"
  | "deprivation"
  | "carAccess"
export interface AtlasDrawerSummary {
  heading?: string
  detail: string
  metric?: string
}

const DRAWERS: readonly {
  layer: LayerId
  mode: AtlasAnalysisMode
  icon: IconName
}[] = [
  { layer: "reach", mode: "reach", icon: "route" },
  { layer: "perCapita", mode: "libraryAccess", icon: "book" },
  { layer: "population", mode: "population", icon: "layers" },
  { layer: "deprivation", mode: "deprivation", icon: "cmp" },
  { layer: "carAccess", mode: "carAccess", icon: "map" },
  { layer: "access", mode: "accessibility", icon: "acc" },
]

export function atlasAnalysisDrawers(
  layers: readonly LayerId[],
  preview: AtlasAnalysisMode | null = null
) {
  return DRAWERS.filter(
    ({ layer, mode }) =>
      layers.includes(layer) || (mode === "accessibility" && preview === mode)
  )
}
