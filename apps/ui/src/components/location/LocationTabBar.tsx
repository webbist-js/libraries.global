"use client"

import { useState } from "react"

import { cn } from "@/lib/styles"

export interface LocationTabBarProps {
  readonly tabs: { id: string; label: string }[]
  readonly activeTabId?: string
}

export function LocationTabBar({ tabs, activeTabId }: LocationTabBarProps) {
  const [active, setActive] = useState(activeTabId ?? tabs[0]?.id)

  const handleScrollTo = (id: string) => {
    setActive(id)
    const el = document.getElementById(id)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 100 // offset for sticky header
      window.scrollTo({ top, behavior: "smooth" })
    }
  }

  return (
    <div
      className="sticky top-14 z-40 w-full border-b border-(--t-border-line) backdrop-blur-md"
      style={{
        background: "var(--t-header-bg)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center px-4 md:px-8">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = active === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => handleScrollTo(tab.id)}
                className={cn(
                  "flex items-center rounded-full px-4 py-1.5 font-mono text-[11px] tracking-[0.12em] whitespace-nowrap uppercase transition-all duration-200",
                  isActive
                    ? "bg-(--t-ink-base) text-(--t-bg-void)"
                    : "border border-(--t-border-line) text-(--t-ink-faint) hover:bg-(--t-bg-surface) hover:text-(--t-ink-dim)"
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
