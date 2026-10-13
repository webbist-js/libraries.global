import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import { PageHero } from "@/components/ds"

import { ContributeNavBar } from "./ContributeNavBar"

/**
 * Shared header for every /contribute route: the v2 PageHero band (breadcrumb,
 * "Contribute" pill, serif title, lead) with the section's tabs on its
 * bottom edge. Landing tabs use the full band; task pages (forms, wizards) pass
 * `compact` so the work starts higher up the page.
 *
 * `title` accepts `*italic*` markup, rendered as indigo italic.
 */
export function ContributeSectionHeader({
  section,
  title,
  lead,
  compact = false,
  back = false,
  children,
}: {
  /** Breadcrumb leaf after "Contribute". Omit on the hub itself. */
  readonly section?: string
  readonly title: string
  readonly lead?: ReactNode
  readonly compact?: boolean
  /**
   * A "‹ Contribute" back pill instead of the breadcrumb and eyebrow, for
   * task pages such as the role application.
   */
  readonly back?: boolean
  /** Rendered under the lead in the right column. */
  readonly children?: ReactNode
}) {
  const tUi = useUiTranslations("ui")

  return (
    <PageHero
      breadcrumb={
        back
          ? undefined
          : section
            ? [
                { label: tUi("home"), href: "/" },
                { label: tUi("contribute"), href: "/contribute" },
                { label: section },
              ]
            : [{ label: tUi("home"), href: "/" }, { label: tUi("contribute") }]
      }
      eyebrow="Contribute"
      eyebrowIcon="mdi:account-group-outline"
      title={title}
      lead={lead}
      compact={compact}
      back={
        back ? { href: "/contribute", label: tUi("contribute") } : undefined
      }
      tabs={<ContributeNavBar />}
    >
      {children}
    </PageHero>
  )
}
