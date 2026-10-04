import type { CSSProperties } from "react"

import { T } from "@/lib/design-tokens"

/** Serif display sizes on the homepage, largest first: the hero, the full
 * bands (Atlas, Contribute, Plans, the closing ask), then section heads. */
export const DISPLAY_SIZE = {
  hero: "clamp(60px,10vw,144px)",
  closing: "clamp(52px,8vw,112px)",
  band: "clamp(46px,6.4vw,88px)",
  section: "clamp(40px,4.8vw,64px)",
} as const

export type DisplaySize = keyof typeof DISPLAY_SIZE

export function displayStyle(size: DisplaySize): CSSProperties {
  return {
    fontFamily: T.font.serif,
    fontWeight: 500,
    fontSize: DISPLAY_SIZE[size],
    lineHeight: 0.98,
    letterSpacing: "-0.02em",
  }
}

/** The 2px ink rule that opens a list section (journeys, coverage). */
export const SECTION_RULE = "#4D4C5B"
