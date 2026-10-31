"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import {
  activeContributeTab,
  NAV_ITEMS,
} from "@/app/[locale]/(dashboard)/contribute/_components/ContributeNavBar"
import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { WorkspaceNavigation } from "@/components/dashboard/WorkspaceNavigation"
import type { SectionTab } from "@/components/ds/SectionTabs"
import { StaffRecordSummary } from "@/components/staff/StaffRecordSummary"
import type { StaffLibrarySummary } from "@/lib/access-server"
import { EDITOR_APPLY_HREF } from "@/lib/editor-gate"
import { usePathname } from "@/lib/navigation"

export function ContributeWorkspace({
  children,
  editor,
  userId,
  library,
  guideHref,
}: {
  readonly children: ReactNode
  readonly editor: boolean
  readonly userId?: string
  readonly library?: StaffLibrarySummary
  readonly guideHref: string
}) {
  const path = usePathname(),
    active = activeContributeTab(path) ?? "hub"
  const nav = useTranslations("contributeNav"),
    ui = useTranslations("ui"),
    t = useTranslations("workspaceDashboard")
  const tabs: SectionTab[] = NAV_ITEMS.map((tab) => ({
    ...tab,
    label: nav(tab.id),
    href: tab.id === "knowledge" && !editor ? EDITOR_APPLY_HREF : tab.href,
  }))
  const ctas: Record<
    string,
    { title: string; body: string; label: string; href: string }
  > = {
    hub: {
      title: t("writingTitle"),
      body: t("writingBody"),
      label: t("startWriting"),
      href: "/contribute?action=journal#start",
    },
    index: {
      title: t("workHereTitle"),
      body: t("workHereBody"),
      label: t("claimLibrary"),
      href: "/staff/claim",
    },
    knowledge: {
      title: t("editorTitle"),
      body: t("editorBody"),
      label: editor ? t("startWriting") : t("editorAction"),
      href: editor ? "/contribute/knowledge" : EDITOR_APPLY_HREF,
    },
    submissions: {
      title: t("reviewTitle"),
      body: t("reviewBody"),
      label: t("contributionGuide"),
      href: guideHref,
    },
    membership: {
      title: t("supportTitle"),
      body: t("supportBody"),
      label: t("meetSupporters"),
      href: "/community/supporters",
    },
  }
  const cta = ctas[active] ?? ctas.hub!

  return (
    <DashboardPage
      title={ui("contribute")}
      className="dashboard-workspace-page dashboard-contribute-page"
      navigationHeading={<RecordContextIdentity title={ui("contribute")} />}
      navigation={
        <>
          <WorkspaceNavigation
            tabs={tabs}
            activeId={active}
            label={ui("contribute")}
          />
          {library && userId ? (
            <StaffRecordSummary library={library} userId={userId} />
          ) : null}
        </>
      }
      navigationFooter={
        <DashboardSidebarCta
          title={cta.title}
          body={cta.body}
          action={{ label: cta.label, href: cta.href }}
        />
      }
      toolbar={
        <RecordToolbar
          items={[
            { label: ui("home"), href: "/" },
            {
              label: ui("contribute"),
              href: active === "hub" ? undefined : "/contribute",
            },
            ...(active !== "hub" ? [{ label: nav(active) }] : []),
          ]}
        />
      }
      overview={<div className="workspace-page-content">{children}</div>}
    />
  )
}
