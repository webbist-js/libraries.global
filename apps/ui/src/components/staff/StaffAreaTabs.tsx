"use client"

import { useTranslations } from "next-intl"

import { SectionTabs, type SectionTab } from "@/components/ds/SectionTabs"

/** Shared destinations for the account’s Team and Library staff access. */
export function StaffAreaTabs({
  active,
  teamId,
  adding = false,
}: {
  readonly active:
    | "overview"
    | "team"
    | "billing"
    | "api"
    | "new"
    | "invite"
    | "claim"
  readonly teamId?: string
  readonly adding?: boolean
}) {
  const t = useTranslations("staffWorkspace")
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
            href: `/staff/teams`,
            icon: "mdi:account-group-outline",
          },
          {
            id: "billing",
            label: t("billing"),
            href: `/staff/teams/billing`,
            icon: "mdi:credit-card-outline",
          },
          {
            id: "api",
            label: t("apiAccess"),
            href: `/staff/teams/api`,
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
