import type { WidgetConfig } from "@repo/shared-data"

import { T } from "@/lib/design-tokens"

/** Readable data ink on widget surfaces in either appearance. Map markers and
 * colour-picker swatches retain the solid brand colours with white labels. */
export const WIDGET_DATA_COLORS: Record<WidgetConfig["accent"], string> = {
  indigo: T.accent.primary,
  green: T.accent.ok,
  rust: T.accent.ember,
  slate: "var(--t-palette-blue-fg)",
  ink: T.ink.base,
}
