import type { ReactNode } from "react"

import { PageHero } from "@/components/ds"

import { CommunityNavBar } from "./CommunityNavBar"

/**
 * Shared header for every /community route: the PageHero band (breadcrumb,
 * "Community" pill, serif title, lead) with the section's tabs on its bottom
 * edge. `title` accepts `*italic*` markup, rendered as indigo italic.
 */
export function CommunitySectionHeader({
  section,
  title,
  lead,
  children,
}: {
  /** Breadcrumb leaf after "Community". Omit on the Noticeboard itself. */
  readonly section?: string
  readonly title: string
  readonly lead?: ReactNode
  /** Rendered under the lead in the right column. */
  readonly children?: ReactNode
}) {
  return (
    <PageHero
      breadcrumb={
        section
          ? [
              { label: "Home", href: "/" },
              { label: "Community", href: "/community" },
              { label: section },
            ]
          : [{ label: "Home", href: "/" }, { label: "Community" }]
      }
      eyebrow="Community"
      eyebrowIcon="mdi:account-group-outline"
      title={title}
      lead={lead}
      tabs={<CommunityNavBar />}
    >
      {children}
    </PageHero>
  )
}
