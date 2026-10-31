import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import {
  WorkspaceHero as PageHero,
  WorkspacePageHeader,
} from "@/components/dashboard/WorkspaceHero"

import { ContributeNavBar } from "./ContributeNavBar"

/** Contained section hero; the persistent workspace owns navigation and breadcrumbs. */
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

  if (compact)
    return (
      <WorkspacePageHeader
        title={title.replaceAll(/\*([^*]+)\*/g, "$1")}
        density="task"
        lead={lead}
        back={
          back ? { href: "/contribute", label: tUi("contribute") } : undefined
        }
        tabs={<ContributeNavBar />}
        actions={children}
      />
    )

  return (
    <PageHero
      variant="card"
      eyebrow={section ?? tUi("contribute")}
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
