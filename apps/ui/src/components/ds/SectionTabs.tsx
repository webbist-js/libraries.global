"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, type ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

export type SectionTab = {
  id: string
  label: ReactNode
  href: string
  /** Iconify id, e.g. "mdi:shield-outline". Indigo on the active tab. */
  icon?: string
  /** Trailing count, e.g. pages in a Knowledge section. Zero is not shown. */
  count?: number
  badge?: ReactNode
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
  roomy = false,
}: {
  readonly tabs: readonly SectionTab[]
  readonly activeId: string | null
  /** Accessible name of the nav landmark, e.g. "Legal documents". */
  readonly label: string
  /** Pass false to keep the scroll position (tabs that filter in place). */
  readonly scroll?: boolean
  readonly className?: string
  readonly roomy?: boolean
}) {
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!roomy) return
    const nav = navRef.current
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !current) return
    const left = current.offsetLeft
    const right = left + current.offsetWidth
    if (left < nav.scrollLeft) nav.scrollLeft = left
    else if (right > nav.scrollLeft + nav.clientWidth)
      nav.scrollLeft = right - nav.clientWidth
  }, [activeId, roomy])

  if (tabs.length < 2) return null

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className={[
        // A right-edge fade says the row scrolls on narrow screens.
        "relative -mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] after:pointer-events-none after:sticky after:right-0 after:-ml-8 after:w-8 after:shrink-0 after:bg-linear-to-l after:from-(--t-bg-space) after:to-transparent sm:after:hidden print:hidden [&::-webkit-scrollbar]:hidden",
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
              "inline-flex shrink-0 items-center gap-2 border border-b-0 font-semibold whitespace-nowrap transition-colors",
              roomy
                ? "min-h-14 rounded-t-[20px] px-4 py-3 text-[16px]"
                : "min-h-11 rounded-t-[14px] px-4 py-2.5 text-[14px]",
              active
                ? "border-(--t-border-line) bg-(--t-bg-void) text-(--t-ink-base)"
                : "border-transparent text-(--t-ink-dim) hover:text-(--t-ink-base)",
            ].join(" ")}
            href={tab.href}
            key={tab.id}
            scroll={scroll}
          >
            {tab.icon ? (
              <span
                aria-hidden="true"
                className="inline-flex size-4 shrink-0 items-center justify-center"
              >
                <Icon
                  height={15}
                  icon={tab.icon}
                  style={active ? { color: T.accent.primary } : undefined}
                  width={15}
                />
              </span>
            ) : null}
            {tab.label}
            {tab.badge}
            {tab.count ? (
              <span
                className="rounded-full px-2 text-[13px] font-bold tabular-nums"
                style={{
                  background: roomy ? T.accent.primary : T.bg.muted,
                  color: roomy ? T.bg.deep : T.ink.dim,
                }}
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
