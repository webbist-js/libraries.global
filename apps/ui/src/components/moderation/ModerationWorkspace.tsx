"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useState, type ReactNode } from "react"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import {
  ModerationNavigationContext,
  type ModerationPageNavigation,
  useModerationRoute,
} from "@/components/moderation/ModerationNavigationContext"
import { ModerationNavigationLinks } from "@/components/moderation/ModerationWorkspaceNav"
import { reviewReturnHref } from "@/components/moderation/queue-navigation"
import type { WorkspaceView } from "@/components/moderation/workspace"
import { usePathname } from "@/lib/navigation"

/** Moderation owns its rail and toolbar, independently of contribution tools. */
export function ModerationWorkspace({
  children,
  views,
}: {
  readonly children: ReactNode
  readonly views: readonly WorkspaceView[]
}) {
  const ui = useTranslations("ui"),
    nav = useTranslations("contributeNav"),
    t = useTranslations("moderationWorkspace"),
    copy = useTranslations("workspaceDashboard")
  const path = usePathname(),
    search = useSearchParams(),
    route = useModerationRoute()
  const [registered, setRegistered] = useState<ModerationPageNavigation | null>(
    null
  )
  const register = useCallback((next: ModerationPageNavigation) => {
    setRegistered(next)

    return () => setRegistered((current) => (current === next ? null : current))
  }, [])
  const queueReturn = reviewReturnHref(search.get("returnTo"))
  const params = queueReturn
    ? new URLSearchParams(queueReturn.split("?")[1] ?? "")
    : search
  const requested = path.startsWith("/moderation/suggestions")
    ? "optionSuggestions"
    : path.startsWith("/moderation/staff/")
      ? "claims"
      : params.get("tab") === "discussions"
        ? "discussions"
        : params.get("category")
  const initialActive =
    views.find((view) => view.id === requested)?.id ??
    (views.length === 1 ? views[0]!.id : "overview")
  const current = registered?.route === route ? registered : null
  const active = current?.active ?? initialActive

  return (
    <ModerationNavigationContext.Provider value={register}>
      <DashboardPage
        title={nav("moderation")}
        className="dashboard-workspace-page dashboard-moderation-page"
        navigationHeading={<RecordContextIdentity title={nav("moderation")} />}
        navigation={
          <ModerationNavigationLinks
            sidebar
            active={active}
            views={current?.views ?? views}
          />
        }
        navigationFooter={
          <DashboardSidebarCta
            title={copy("reviewerTitle")}
            body={copy("reviewerBody")}
            action={{
              label: copy("reviewerGuide"),
              href: "/knowledge?section=governance",
            }}
          />
        }
        toolbar={
          <RecordToolbar
            items={[
              { label: ui("home"), href: "/" },
              {
                label: nav("moderation"),
                href:
                  path === "/moderation" && active === "overview"
                    ? undefined
                    : "/moderation",
              },
              ...(active !== "overview" ? [{ label: t(active) }] : []),
            ]}
          />
        }
        overview={<div className="workspace-page-content">{children}</div>}
      />
    </ModerationNavigationContext.Provider>
  )
}
