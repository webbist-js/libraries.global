"use client"

import { useState, type ReactNode } from "react"

/** Retain an on-demand workspace until Radix finishes its close animation and
 * restores focus. Unmount afterwards so private summaries reset on every open. */
export function DrawerPresence({
  open,
  children,
}: {
  readonly open: boolean
  readonly children: (onAfterClose: () => void) => ReactNode
}) {
  const [present, setPresent] = useState(open)
  if (open && !present) setPresent(true)

  return open || present ? children(() => setPresent(false)) : null
}
