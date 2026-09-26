import type { ReactNode } from "react"

import { PageHero } from "@/components/ds"

import { ContributeNavBar } from "./ContributeNavBar"

/**
 * Shared header for every /contribute route: the v2 PageHero band (breadcrumb,
 * "Contribute" pill, serif title, lead) followed by the section's sticky tab
 * bar. Landing tabs use the full band; task pages (forms, wizards) pass
 * `compact` so the work starts higher up the page.
 *
 * `title` accepts `*italic*` markup, rendered as indigo italic.
 */
export function ContributeSectionHeader({
  section,
  title,
  lead,
  compact = false,
  children,
}: {
  /** Breadcrumb leaf after "Contribute". Omit on the hub itself. */
  readonly section?: string
  readonly title: string
  readonly lead?: ReactNode
  readonly compact?: boolean
  /** Rendered under the lead in the right column. */
  readonly children?: ReactNode
}) {
  return (
    <>
      <PageHero
        breadcrumb={
          section
            ? [
                { label: "Home", href: "/" },
                { label: "Contribute", href: "/contribute" },
                { label: section },
              ]
            : [{ label: "Home", href: "/" }, { label: "Contribute" }]
        }
        eyebrow="Contribute"
        eyebrowIcon="mdi:account-group-outline"
        title={title}
        lead={lead}
        compact={compact}
      >
        {children}
      </PageHero>
      <ContributeNavBar />
    </>
  )
}
