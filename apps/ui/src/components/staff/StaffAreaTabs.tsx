"use client"

import { useTranslations } from "next-intl"

import { useOptionalDashboardOverlay } from "@/components/dashboard/DashboardFrame"
import { SectionTabs, type SectionTab } from "@/components/ds/SectionTabs"

export type StaffAreaTab =
  | "overview"
  | "team"
  | "billing"
  | "api"
  | "widgets"
  | "networks"
  | "new"
  | "invite"
  | "claim"

export function staffAreaTabs(
  t: (
    key:
      | "yourLibraries"
      | "networks"
      | "membersLibraries"
      | "billing"
      | "widgets"
      | "apiAccess"
      | "claimLibrary"
      | "addLibrary"
      | "teams"
  ) => string,
  teamId?: string,
  adding = false
): SectionTab[] {
  return [
    {
      id: "overview",
      label: t("yourLibraries"),
      href: "/staff",
      icon: "mdi:library-outline",
    },
    {
      id: "networks",
      label: t("networks"),
      href: "/staff/networks",
      icon: "mdi:domain",
    },
    {
      id: "team",
      label: t(teamId ? "membersLibraries" : "teams"),
      href: "/staff/teams",
      icon: "mdi:account-group-outline",
    },
    ...(teamId
      ? [
          {
            id: "billing",
            label: t("billing"),
            href: "/staff/teams/billing",
            icon: "mdi:credit-card-outline",
          },
        ]
      : []),
    {
      id: "widgets",
      label: t("widgets"),
      href: "/staff/teams/widgets",
      icon: "mdi:widgets-outline",
    },
    {
      id: "api",
      label: t("apiAccess"),
      href: "/developers",
      icon: "mdi:code-tags",
    },
    {
      id: "claim",
      label: t("claimLibrary"),
      href: "/staff/claim",
      icon: "mdi:shield-check-outline",
    },
    ...(adding
      ? [
          {
            id: "new",
            label: t("addLibrary"),
            href: "/staff/new",
            icon: "mdi:plus",
          },
        ]
      : []),
  ]
}

/** Shared destinations for the account’s Team and Library staff access. */
export function StaffAreaTabs({
  active,
  teamId,
  adding = false,
}: {
  readonly active: StaffAreaTab
  readonly teamId?: string
  readonly adding?: boolean
}) {
  const t = useTranslations("staffWorkspace")
  const overlay = useOptionalDashboardOverlay()
  if (overlay) return null
  const tabs = staffAreaTabs(t, teamId, adding)

  return <SectionTabs tabs={tabs} activeId={active} label={t("navigation")} />
}
