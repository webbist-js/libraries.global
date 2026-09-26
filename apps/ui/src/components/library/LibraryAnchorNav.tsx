import { LIB_ICONS, LibIcon } from "@/components/library/LibrarySectionCard"
import { T } from "@/lib/design-tokens"

export interface AnchorItem {
  href: string
  label: string
  icon: string
}

export const LIBRARY_ANCHORS = {
  photos: { href: "#photos", label: "Photos", icon: LIB_ICONS.photos },
  visit: { href: "#visit", label: "Visit & hours", icon: LIB_ICONS.pin },
  access: { href: "#access", label: "Accessibility", icon: LIB_ICONS.access },
  collections: {
    href: "#collections",
    label: "Collections",
    icon: LIB_ICONS.book,
  },
  history: { href: "#history", label: "History", icon: LIB_ICONS.clock },
  events: { href: "#events", label: "Events", icon: LIB_ICONS.calendar },
  sources: { href: "#sources", label: "Sources", icon: LIB_ICONS.list },
} as const

/** Sticky "On this page" pill nav (POC pattern). Sits below the 56px header. */
export function LibraryAnchorNav({ items }: { readonly items: AnchorItem[] }) {
  return (
    <nav
      aria-label="On this page"
      className="sticky top-14 z-5 mt-7 flex flex-wrap gap-1.5 py-2.5"
      style={{
        borderTop: `1px solid ${T.border.line}`,
        borderBottom: `1px solid ${T.border.line}`,
        background: T.bg.void,
      }}
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="flex items-center gap-[7px] rounded-full px-3 py-2 text-[15px] font-medium no-underline transition-colors hover:bg-(--t-bg-muted-2)"
          style={{ color: T.ink.base }}
        >
          <LibIcon d={item.icon} />
          {item.label}
        </a>
      ))}
    </nav>
  )
}
