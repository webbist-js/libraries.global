"use client"

import { useState } from "react"

import { StickySubNav } from "@/components/ds"

export interface LocationTabBarProps {
  readonly tabs: { id: string; label: string }[]
  readonly activeTabId?: string
}

export function LocationTabBar({ tabs, activeTabId }: LocationTabBarProps) {
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
    <StickySubNav tabs={tabs} activeId={active} onTabClick={handleScrollTo} />
  )
}
