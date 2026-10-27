import type {
  WidgetConfig,
  WidgetResolved,
  WidgetSelectionSpec,
  WidgetType,
} from "@repo/shared-data"

export type WidgetPresentationData = WidgetResolved & {
  type: WidgetType
  config: WidgetConfig
  spec: WidgetSelectionSpec
  publisher: string
}

export function widgetDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const rad = Math.PI / 180,
    dlat = (b.lat - a.lat) * rad,
    dlng = (b.lng - a.lng) * rad

  return (
    6371 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(dlat / 2) ** 2 +
          Math.cos(a.lat * rad) *
            Math.cos(b.lat * rad) *
            Math.sin(dlng / 2) ** 2
      )
    )
  )
}
