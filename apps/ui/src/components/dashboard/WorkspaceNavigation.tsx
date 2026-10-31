"use client"

import { Icon } from "@iconify/react"

import type { SectionTab } from "@/components/ds/SectionTabs"
import { Link } from "@/lib/navigation"
import { workspaceNavigationAttributes } from "@/lib/workspace-analytics"

/** Compact destinations shared by staff and contribution workspaces. */
export function WorkspaceNavigation({
  tabs,
  activeId,
  label,
}: {
  readonly tabs: readonly SectionTab[]
  readonly activeId: string | null
  readonly label: string
}) {
  return (
    <nav className="workspace-navigation" aria-label={label}>
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          {...workspaceNavigationAttributes(tab.href)}
          aria-current={tab.id === activeId ? "page" : undefined}
        >
          {tab.icon ? <Icon icon={tab.icon} width={19} aria-hidden /> : null}
          <span>{tab.label}</span>
          {tab.count != null && tab.count > 0 ? (
            <small>{tab.count}</small>
          ) : null}
          {tab.badge}
        </Link>
      ))}
    </nav>
  )
}
