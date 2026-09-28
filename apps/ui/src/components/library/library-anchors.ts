// The library page's "On this page" tabs. Kept out of the client nav
// component so the server page can read the list.

import { LIB_ICONS } from "@/components/library/LibrarySectionCard"

export interface AnchorItem {
  href: string
  label: string
  icon: string
  /** Marks a section with Pro analysis in it. */
  pro?: boolean
}

export const LIBRARY_ANCHORS = {
  visit: { href: "#visit", label: "Visit", icon: LIB_ICONS.pin },
  access: { href: "#access", label: "Accessibility", icon: LIB_ICONS.access },
  history: { href: "#history", label: "History", icon: LIB_ICONS.clock },
  collections: {
    href: "#collections",
    label: "Collections",
    icon: LIB_ICONS.book,
  },
  events: { href: "#events", label: "Events", icon: LIB_ICONS.calendar },
  area: { href: "#area", label: "In the area", icon: LIB_ICONS.map, pro: true },
  sources: { href: "#sources", label: "Sources", icon: LIB_ICONS.list },
  reuse: { href: "#reuse", label: "Reuse", icon: LIB_ICONS.download },
} as const satisfies Record<string, AnchorItem>
