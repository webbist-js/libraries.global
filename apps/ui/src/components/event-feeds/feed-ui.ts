// Shared pill classes for the event-feed screens, so Connect, Replace, the
// organisation picker and each feed row draw the same buttons.
import type React from "react"

import { T } from "@/lib/design-tokens"

/** Indigo primary pill: Connect, Send for review. */
export const PRIMARY_PILL =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-(--t-action-primary) px-5 text-sm font-semibold text-white no-underline transition-colors hover:bg-(--t-action-primary-hover) disabled:cursor-not-allowed disabled:opacity-50"

/** White outlined pill: Test connection, Pause, Replace details, Cancel. */
export const SECONDARY_PILL =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border bg-(--t-bg-deep) px-4 text-sm font-semibold no-underline transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-50"

export const secondaryPillStyle: React.CSSProperties = {
  borderColor: T.border.hi,
  color: T.ink.base,
}

/** The one-line error for a 429 from the feed routes. */
export const TOO_MANY_REQUESTS =
  "Too many requests just now. Wait a minute, then try again."
