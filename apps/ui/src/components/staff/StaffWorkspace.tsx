"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState, type ReactNode } from "react"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { WorkspaceNavigation } from "@/components/dashboard/WorkspaceNavigation"
import { Badge } from "@/components/ds/Badge"
import { staffLibraryTabs } from "@/components/staff/staff-library-navigation"
import { staffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { StaffRecordSummary } from "@/components/staff/StaffRecordSummary"
import {
  StaffWorkspaceRecordContext,
  type StaffWorkspaceRecord,
} from "@/components/staff/StaffWorkspaceRecord"
import type { StaffLibrarySummary } from "@/lib/access-server"
import { usePathname } from "@/lib/navigation"

export function StaffWorkspace({
  children,
  libraries,
  userId,
  teamId,
  adding,
  guideHref,
}: {
  readonly children: ReactNode
  readonly libraries: StaffLibrarySummary[]
  readonly userId?: string
  readonly teamId?: string
  readonly adding: boolean
  readonly guideHref: string
}) {
  const dashboard = useTranslations("dashboard")
  const ui = useTranslations("ui"),
    t = useTranslations("staffWorkspace"),
    copy = useTranslations("workspaceDashboard")
  const [record, setRecord] = useState<StaffWorkspaceRecord | null>(null)
  const register = useCallback((next: StaffWorkspaceRecord) => {
    setRecord(next)

    return () => setRecord((current) => (current === next ? null : current))
  }, [])
  const path = usePathname()
  const segments = path.split("/").filter(Boolean).slice(1)
  const currentRecord = record?.slug === segments[0] ? record : null
  const library =
    currentRecord ?? libraries.find((lib) => lib.slug === segments[0])
  const tabs = library
    ? staffLibraryTabs(
        library.slug,
        library.libraryType === "Mobile",
        ui,
        currentRecord?.suggestions,
        dashboard("overview")
      ).map((tab) => ({
        ...tab,
        badge:
          currentRecord &&
          !currentRecord.teamCovered &&
          ["traffic", "team"].includes(tab.id) ? (
            <Badge label="Team" color="aurora" icon="mdi:lock-outline" />
          ) : undefined,
      }))
    : staffAreaTabs(t, teamId, adding)
  const active = library
    ? segments[1] || "overview"
    : ([...tabs]
        .sort((a, b) => b.href.length - a.href.length)
        .find(
          (tab) =>
            path === tab.href ||
            (tab.href !== "/staff" && path.startsWith(`${tab.href}/`))
        )?.id ?? "overview")
  const selected = tabs.find((tab) => tab.id === active)
  const summaryLibrary = library ?? libraries[0]

  return (
    <StaffWorkspaceRecordContext.Provider value={register}>
      <DashboardPage
        title={ui("staff_area")}
        className="dashboard-workspace-page dashboard-staff-page"
        navigationHeading={
          <RecordContextIdentity
            title={library?.name ?? ui("staff_area")}
            eyebrow={library ? ui("verified_staff") : undefined}
            parent={
              library
                ? { href: "/staff", label: t("yourLibraries") }
                : undefined
            }
          />
        }
        mobileNavigationHeading={
          library ? (
            <RecordContextIdentity
              title={library.name}
              parent={{ href: "/staff", label: t("yourLibraries") }}
            />
          ) : undefined
        }
        navigation={
          <>
            <WorkspaceNavigation
              tabs={tabs}
              activeId={active}
              label={t("navigation")}
            />
            {summaryLibrary && userId ? (
              <StaffRecordSummary
                key={summaryLibrary.id}
                library={summaryLibrary}
                userId={userId}
              />
            ) : null}
          </>
        }
        navigationFooter={
          <DashboardSidebarCta
            title={copy("staffHelpTitle")}
            body={copy("staffHelpBody")}
            action={{ label: copy("staffGuide"), href: guideHref }}
          />
        }
        toolbar={
          <RecordToolbar
            items={[
              { label: ui("home"), href: "/" },
              {
                label: ui("staff_area"),
                href: path === "/staff" ? undefined : "/staff",
              },
              ...(library
                ? [
                    {
                      label: library.name,
                      href:
                        segments.length > 1
                          ? `/staff/${library.slug}`
                          : undefined,
                    },
                  ]
                : []),
              ...(selected && active !== "overview"
                ? [{ label: String(selected.label) }]
                : []),
            ]}
          />
        }
        overview={<div className="workspace-page-content">{children}</div>}
      />
    </StaffWorkspaceRecordContext.Provider>
  )
}
