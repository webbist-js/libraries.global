"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { T } from "@/lib/design-tokens"

export interface LocationTabBarProps {
  readonly tabs: { id: string; label: string }[]
  readonly activeTabId?: string
}

/** v2 sticky on-this-page pill nav (matches the library page anchor nav). */
export function LocationTabBar({ tabs, activeTabId }: LocationTabBarProps) {
  const tUi = useUiTranslations("ui")

  const [active, setActive] = useState(activeTabId ?? tabs[0]?.id ?? "")

  const handleScrollTo = (id: string) => {
    setActive(id)
    const el = document.getElementById(id)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 100
      window.scrollTo({ top, behavior: "smooth" })
    }
  }

  return (
    <nav
      data-sticky-navigation=""
      aria-label={tUi("on_this_page")}
      className="sticky top-(--sticky-header-height) z-[5] mt-8 border-y"
      style={{ background: T.bg.void, borderColor: T.border.line }}
    >
      <div className="mx-auto flex max-w-[1360px] flex-wrap gap-1 overflow-x-auto px-4 py-2 sm:px-8">
        {tabs.map((tab) => {
          const isActive = tab.id === active

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleScrollTo(tab.id)}
              aria-current={isActive ? "true" : undefined}
              className="rounded-full px-3.5 py-2 text-base font-medium whitespace-nowrap transition-colors"
              style={{
                color: isActive ? T.accent.primary : T.ink.base,
                background: isActive ? T.accent.chip : "transparent",
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
