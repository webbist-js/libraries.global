import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

export type SectionTab = {
  id: string
  label: ReactNode
  href: string
  /** Iconify id, e.g. "mdi:shield-outline". Indigo on the active tab. */
  icon?: string
  /** Trailing count, e.g. pages in a Knowledge section. */
  count?: number
}

/**
 * Folder tabs that sit on the bottom edge of a hero band (PageHero's `tabs`
 * slot, or the legal document hero). The active tab takes the page colour
 * and covers the band's bottom border, so it reads as the page below.
 * Internal links only: each tab is a real URL, marked with aria-current.
 */
export function SectionTabs({
  tabs,
  activeId,
  label,
  scroll,
  className,
}: {
  readonly tabs: readonly SectionTab[]
  readonly activeId: string | null
  /** Accessible name of the nav landmark, e.g. "Legal documents". */
  readonly label: string
  /** Pass false to keep the scroll position (tabs that filter in place). */
  readonly scroll?: boolean
  readonly className?: string
}) {
  if (tabs.length < 2) return null

  return (
    <nav
      aria-label={label}
      className={[
        "-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] print:hidden [&::-webkit-scrollbar]:hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={[
              "inline-flex shrink-0 items-center gap-2 rounded-t-[14px] border border-b-0 px-4 py-2.5 text-[14px] font-semibold whitespace-nowrap transition-colors",
              active
                ? "border-(--t-border-line) bg-(--t-bg-void) text-(--t-ink-base)"
                : "border-transparent text-(--t-ink-dim) hover:text-(--t-ink-base)",
            ].join(" ")}
            href={tab.href}
            key={tab.id}
            scroll={scroll}
          >
            {tab.icon ? (
              <Icon
                aria-hidden="true"
                height={15}
                icon={tab.icon}
                style={active ? { color: T.accent.primary } : undefined}
                width={15}
              />
            ) : null}
            {tab.label}
            {tab.count != null ? (
              <span
                className="font-medium tabular-nums"
                style={{ color: active ? T.ink.dim : T.ink.low }}
              >
                {tab.count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
