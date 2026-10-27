import type { CSSProperties } from "react"

import { T } from "@/lib/design-tokens"

/** Display sizes on the homepage, largest first: the hero, the full
 * bands (Atlas, Contribute, Plans, the closing ask), then section heads. */
export const DISPLAY_TYPE = {
  hero: T.type.displayHero,
  closing: T.type.displayClosing,
  band: T.type.displayBand,
  section: T.type.displaySection,
} as const

export type DisplaySize = keyof typeof DISPLAY_TYPE

export function displayStyle(size: DisplaySize): CSSProperties {
  return {
    font: DISPLAY_TYPE[size],
    letterSpacing: "var(--type-display-tracking)",
  }
}

/** The 2px ink rule that opens a list section (journeys, coverage). */
export const SECTION_RULE = "#4D4C5B"
