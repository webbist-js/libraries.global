"use client"

import * as React from "react"

import { usePathname } from "@/lib/navigation"

// Next supplies the transition API. Stable React embeds (including Storybook)
// and unsupported browsers retain the same semantic content without animation.
const Transition =
  React.ViewTransition ??
  (({ children }: { children?: React.ReactNode }) => <>{children}</>)
const directions = {
  "atlas-forward": "atlas-forward",
  "atlas-back": "atlas-back",
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  "section-forward": "section-forward",
  "section-back": "section-back",
  default: "page-crossfade",
}

/** The canvas moves; named sidebar and toolbar snapshots are excluded and anchored. */
export function DashboardRouteTransition({
  children,
  routeKey,
}: {
  readonly children: React.ReactNode
  readonly routeKey?: string
}) {
  const pathname = usePathname()

  return (
    <Transition
      key={routeKey ?? pathname}
      name="dashboard-page"
      share={directions}
      enter={directions}
      exit={directions}
      default="none"
    >
      {children}
    </Transition>
  )
}

/** Replace sidebar contents in place for every route, including Atlas geography. */
export function DashboardContextTransition({
  children,
  routeKey,
}: {
  readonly children: React.ReactNode
  readonly routeKey: string
}) {
  return (
    <Transition
      key={routeKey}
      name="dashboard-context"
      share="dashboard-still"
      enter="dashboard-still"
      exit="dashboard-still"
      default="none"
    >
      {children}
    </Transition>
  )
}
