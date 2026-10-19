"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, type ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

export type SectionTab = {
  id: string
  label: ReactNode
  href: string
  /** Optional Iconify id, shown before the tab label. */
  icon?: string
  /** Trailing count, e.g. pages in a Knowledge section. Zero is not shown. */
  count?: number
  badge?: ReactNode
}

/**
 * Underline tabs for the shared sticky SectionNavigation bar.
 * The selected tab stays in view when the row scrolls on narrow screens.
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
        "relative -mb-px flex min-w-0 flex-1 gap-1 self-stretch overflow-x-auto [scrollbar-width:none] after:pointer-events-none after:sticky after:right-0 after:-ml-6 after:w-6 after:shrink-0 after:bg-linear-to-l after:from-(--t-bg-deep) after:to-transparent sm:after:hidden print:hidden [&::-webkit-scrollbar]:hidden",
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
              "inline-flex shrink-0 items-center gap-2 border-b-2 font-medium whitespace-nowrap transition-colors duration-150 focus-visible:-outline-offset-4! motion-reduce:transition-none",
              roomy
                ? "min-h-[60px] px-4 py-3 text-[16px]"
                : "min-h-[56px] px-3 py-3 text-[15px]",
              active
                ? "border-(--t-accent-primary) font-semibold text-(--t-ink-base)"
                : "border-transparent text-(--t-ink-dim) hover:border-(--t-accent-primary)/35 hover:text-(--t-accent-primary) focus-visible:text-(--t-accent-primary)",
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
                <Icon height={15} icon={tab.icon} width={15} />
              </span>
            ) : null}
            {tab.label}
            {tab.badge}
            {tab.count ? (
              <span
                className="rounded-full px-1.5 py-0.5 text-[13px] leading-none font-semibold tabular-nums"
                style={{
                  background: T.bg.muted,
                  color: T.ink.dim,
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
