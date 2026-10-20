"use client"

import { useTranslations } from "next-intl"

import { SectionTabs, type SectionTab } from "@/components/ds/SectionTabs"

/** Shared staff destinations; a Team selection survives navigation. */
export function StaffAreaTabs({
  active,
  teamId,
  adding = false,
}: {
  readonly active: "overview" | "team" | "api" | "new" | "invite" | "claim"
  readonly teamId?: string
  readonly adding?: boolean
}) {
  const t = useTranslations("staffWorkspace")
  const query = teamId ? `?team=${encodeURIComponent(teamId)}` : ""
  const tabs: SectionTab[] = [
    {
      id: "overview",
      label: t("yourLibraries"),
      href: "/staff",
      icon: "mdi:library-outline",
    },
    ...(teamId
      ? [
          {
            id: "team",
            label: t("membersLibraries"),
            href: `/staff/team${query}`,
            icon: "mdi:account-group-outline",
          },
          {
            id: "api",
            label: t("apiAccess"),
            href: `/staff/team/api${query}`,
            icon: "mdi:code-tags",
          },
        ]
      : []),
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

  return <SectionTabs tabs={tabs} activeId={active} label={t("navigation")} />
}
