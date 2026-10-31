import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import { WorkspaceHero as PageHero } from "@/components/dashboard/WorkspaceHero"
import type { BreadcrumbItem } from "@/components/ds/Breadcrumb"

import { CommunityNavBar, type CommunityTabCounts } from "./CommunityNavBar"

/**
 * Editorial community header; the workspace owns navigation when present.
 * Detail readers own their title; task pages use WorkspacePageHeader.
 */
export function CommunitySectionHeader({
  crumbs,
  title,
  lead,
  counts,
  children,
  leadPlacement,
  actions,
  showEyebrow = true,
  showTabs = true,
  displayTitle,
  prelude,
  footer,
  emphasisTone,
}: {
  /** @deprecated The persistent toolbar supplies section context; retained for older callers. */
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
  readonly displayTitle?: boolean
  readonly prelude?: ReactNode
  readonly footer?: ReactNode
  readonly emphasisTone?: "brand" | "ink"
}) {
  const tUi = useUiTranslations("ui")

  return (
    <PageHero
      variant="card"
      displayTitle={displayTitle}
      prelude={prelude}
      footer={footer}
      emphasisTone={emphasisTone}
      breadcrumb={
        crumbs?.length
          ? [{ label: tUi("community"), href: "/community" }, ...crumbs]
          : undefined
      }
      eyebrow={showEyebrow ? tUi("community") : undefined}
      eyebrowIcon="mdi:account-group-outline"
      title={title}
      lead={lead}
      leadPlacement={leadPlacement}
      actions={actions}
      tabs={
        showTabs ? (
          <div className="community-mobile-tabs">
            <CommunityNavBar counts={counts} />
          </div>
        ) : undefined
      }
    >
      {children}
    </PageHero>
  )
}
