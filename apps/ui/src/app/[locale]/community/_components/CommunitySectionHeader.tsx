import type { ReactNode } from "react"

import { type BreadcrumbItem, PageHero } from "@/components/ds"

import { CommunityNavBar, type CommunityTabCounts } from "./CommunityNavBar"

/**
 * Shared header for every /community route: the PageHero band (breadcrumb,
 * "Community" pill, serif title, lead) with the section's tabs on its bottom
 * edge. `title` accepts `*italic*` markup, rendered as indigo italic.
 */
export function CommunitySectionHeader({
  section,
  crumbs,
  title,
  lead,
  counts,
  children,
  leadPlacement,
  actions,
  showEyebrow = true,
  showTabs = true,
}: {
  /** Breadcrumb leaf after "Community". Omit on the Noticeboard itself. */
  readonly section?: string
  /**
   * The trail after "Community" when one leaf isn't enough (Community ›
   * Drives › a drive); wins over `section`. The last item is the page.
   */
  readonly crumbs?: readonly BreadcrumbItem[]
  readonly title: string
  readonly lead?: ReactNode
  /** Tab counts (open drives, open suggestions); a zero or missing count shows none. */
  readonly counts?: CommunityTabCounts
  /** Rendered under the lead in the right column. */
  readonly children?: ReactNode
  readonly leadPlacement?: "left" | "right"
  readonly actions?: ReactNode
  readonly showEyebrow?: boolean
  readonly showTabs?: boolean
}) {
  const trail = crumbs?.length ? crumbs : section ? [{ label: section }] : []

  return (
    <PageHero
      breadcrumb={
        trail.length > 0
          ? [
              { label: "Home", href: "/" },
              { label: "Community", href: "/community" },
              ...trail,
            ]
          : [{ label: "Home", href: "/" }, { label: "Community" }]
      }
      eyebrow={showEyebrow ? "Community" : undefined}
      eyebrowIcon="mdi:account-group-outline"
      title={title}
      lead={lead}
      leadPlacement={leadPlacement}
      actions={actions}
      tabs={showTabs ? <CommunityNavBar counts={counts} /> : undefined}
    >
      {children}
    </PageHero>
  )
}
