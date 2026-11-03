"use client"

import { guardHiddenViewTransitions } from "@/lib/view-transition-guard"

// Installed when this module first runs in the browser, before React starts
// any route transition.
if (typeof document !== "undefined") guardHiddenViewTransitions()

/** Mount once in the root layout; renders nothing. */
export function ViewTransitionGuard() {
  return null
}
